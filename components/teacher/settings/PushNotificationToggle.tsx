"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIosBrowser } from "@/lib/pwa";
import {
  pushSupportState,
  subscriptionToPayload,
  urlBase64ToUint8Array,
  type PushSupport,
} from "@/lib/push";
import {
  releasePushSubscription,
  rememberPushOwner,
} from "@/lib/push-client";
import { createClient } from "@/lib/supabase/client";

/** A worker that never activates would otherwise strand the button mid-flight
 *  with no way to retry, because `serviceWorker.ready` does not settle when
 *  nothing is registered — which is exactly the case under `next dev`, where
 *  ServiceWorkerRegistrar unregisters the worker. */
const WORKER_READY_TIMEOUT_MS = 10_000;

async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!(await navigator.serviceWorker.getRegistration("/"))) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), WORKER_READY_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Push is per-device: the control reflects THIS browser's subscription and never
 * claims to speak for the teacher's other devices. iOS exposes push only in an
 * installed PWA (16.4+), so there the install hint is the only actionable path.
 *
 * Deliberately NOT inside the policy <form>: subscribing is an immediate effect,
 * and hanging it off the form's Save button would strand a subscription when the
 * teacher forgets to press it.
 */
export function PushNotificationToggle({ pushConfigured }: { pushConfigured: boolean }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // The key is served by the running server, not inlined into this bundle, so
    // a published image works with whatever keys the operator sets. A failure
    // resolves to null, which hides the control instead of offering a broken
    // one.
    const config = await fetch("/api/push/config")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    setPublicKey(config?.publicKey ?? null);

    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManager = "PushManager" in window;
    const hasNotification = "Notification" in window;

    if (hasServiceWorker) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    }

    setSupport(
      pushSupportState({
        hasServiceWorker,
        hasPushManager,
        hasNotification,
        isIos: isIosBrowser({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
          hasStandaloneProperty: "standalone" in navigator,
        }),
        standalone:
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
        permission: hasNotification ? Notification.permission : "denied",
      })
    );
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    // Subscribe this browser and register it with the server. A foreign
    // endpoint (RLS rejects the upsert with 42501/23505) comes back as 409; the
    // caller then retries once with a fresh endpoint.
    async function subscribeOnce(): Promise<{
      ok: boolean;
      conflict: boolean;
      error?: string;
    }> {
      const reg = await activeRegistration();
      if (!reg) {
        return {
          ok: false,
          conflict: false,
          error:
            "Notifications need the app's service worker, which only runs in a production build. Reload the page and try again.",
        };
      }
      if (!publicKey) {
        return {
          ok: false,
          conflict: false,
          error: "Notifications are not configured on this server.",
        };
      }
      const sub = await reg.pushManager.subscribe({
        // Chromium requires this; it is the same contract Safari enforces by
        // revoking a subscription that receives pushes without showing one.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionToPayload(sub)),
      });
      if (!res.ok) {
        // Retire this browser's subscription on ANY failure. For a 409 it is
        // exactly what unblocks the retry: the new attempt mints a different
        // endpoint that cannot collide with the other teacher's row.
        await sub.unsubscribe().catch(() => {});
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          conflict: res.status === 409,
          error: data.error ?? "Could not save this device.",
        };
      }
      return { ok: true, conflict: false };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          permission === "denied"
            ? "Notifications are blocked for this site — re-enable them in your browser settings."
            : "Permission was not granted."
        );
        return;
      }

      let attempt = await subscribeOnce();
      // Exactly one retry: subscribeOnce() already unsubscribed the conflicting
      // browser subscription, so the second attempt starts from a clean slate.
      if (!attempt.ok && attempt.conflict) {
        attempt = await subscribeOnce();
      }
      if (!attempt.ok) {
        setMessage(attempt.error ?? "Could not save this device.");
        return;
      }

      // This browser's subscription now belongs to the signed-in teacher, so
      // record the owner: a later sign-in by a different teacher must be able to
      // recognise and release it. Read the id from the live session rather than
      // a network round trip.
      const { data } = await createClient().auth.getSession();
      const ownerId = data.session?.user.id;
      if (ownerId) rememberPushOwner(ownerId);
      setMessage("Notifications are on for this device.");
    } catch {
      setMessage("Could not enable notifications on this device.");
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  }, [refresh, publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await releasePushSubscription();
      setMessage("Notifications are off for this device.");
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  }, [refresh]);

  // Hidden unless the SERVER has BOTH VAPID keys — pushConfigured is the server's
  // verdict, so a half-configured self-host cannot promise delivery it can never
  // make. The public key is fetched from the server at request time (see
  // refresh) rather than inlined into this bundle, so a prebuilt image follows
  // whatever keys the operator sets; a missing key hides the control.
  if (!pushConfigured) return null;
  if (!publicKey) return null;
  if (!support || support === "unsupported") return null;

  return (
    <div className="border-t border-border pt-3 mt-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm">
          <span className="font-medium">Push notifications on this device</span>
          <span className="block text-xs text-muted">
            {support === "install-first"
              ? "On iPhone and iPad, add CogNote to your Home Screen first — iOS only allows notifications in the installed app (iOS 16.4+)."
              : support === "denied"
                ? "Blocked in your browser settings for this site."
                : "Alerts in your phone's notification tray, even when CogNote is closed."}
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant={subscribed ? "ghost" : "primary"}
          disabled={busy || support !== "available"}
          aria-pressed={subscribed}
          aria-busy={busy}
          onClick={() => void (subscribed ? disable() : enable())}
        >
          {busy ? "…" : subscribed ? "Turn off" : "Turn on"}
        </Button>
      </div>
      {message && <p className="text-xs text-muted mt-1">{message}</p>}
    </div>
  );
}
