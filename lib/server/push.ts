import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasVapidPublicKey, pushPayloadFromNotification } from "@/lib/push";

export type PushDeliveryResult = {
  /** Subscriptions successfully handed to the push service. */
  sent: number;
  /** Subscriptions deleted because the service returned 404/410. */
  dropped: number;
  /** Why nothing was sent, when nothing was: no VAPID keys, or the send aborted (already logged). */
  skipped: false | "unconfigured" | "error";
};

/**
 * Seconds the push service retains the message while the device is offline.
 * Deliberately short: the in-app bell is the durable record of every event, so
 * a nudge that surfaces many hours late is worse than one that never arrives —
 * a "lesson cancelled" alert read the next morning is actively misleading.
 */
export const PUSH_TTL_SECONDS = 60 * 60;

/** 404/410 mean the subscription is gone for good; anything else may be transient. */
export function pushSendOutcome(statusCode: number | undefined): "drop" | "fail" {
  return statusCode === 404 || statusCode === 410 ? "drop" : "fail";
}

/**
 * VAPID is optional: a self-hosted studio that has not generated keys simply
 * gets no push, and the send path short-circuits instead of throwing.
 */
export function isPushConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/**
 * The VAPID public key to hand a browser, or null when push cannot work here.
 *
 * Read per request and deliberately never inlined into the client bundle: a
 * key baked in at image-build time would pin every instance to the publisher's
 * keypair, so a published image could not run with the operator's own keys.
 * The key is public by design — every subscription request carries it.
 */
export function clientVapidPublicKey(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isPushConfigured(env)) return null;
  const key = env.VAPID_PUBLIC_KEY;
  return key && hasVapidPublicKey(key) ? key : null;
}

let vapidReady = false;

/** Requires VAPID to be configured — callers must gate on isPushConfigured(). */
function configureVapid(): void {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    // VAPID_PUBLIC_KEY deliberately has no NEXT_PUBLIC_ prefix: that prefix is
    // what tells the bundler to inline a value at build time, which would bake
    // the publisher's key into a published image and shadow whatever the
    // operator sets at runtime. Without it the key is read straight from the
    // environment per call, exactly like VAPID_SUBJECT and VAPID_PRIVATE_KEY.
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidReady = true;
}

/**
 * Send one notification to every device the teacher has enabled. Accepts the
 * caller's client so the service-role callers (portal cancel, portal RSVP,
 * Stripe webhook) need no extra plumbing.
 */
export async function sendPushToTeacher(
  supabase: SupabaseClient,
  teacherId: string,
  notification: {
    title: string;
    body?: string | null;
    href?: string | null;
    /** The notification row's id, used as the tray tag so re-delivery replaces. */
    id?: string | null;
    /** The notification row's created_at (ISO): the event time to stamp. */
    createdAt?: string | null;
  }
): Promise<PushDeliveryResult> {
  if (!isPushConfigured()) return { sent: 0, dropped: 0, skipped: "unconfigured" };

  try {
    configureVapid();

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("teacher_id", teacherId);

    if (error) {
      console.error("sendPushToTeacher load failed:", error.message);
      return { sent: 0, dropped: 0, skipped: false };
    }
    const subs = data ?? [];
    if (subs.length === 0) return { sent: 0, dropped: 0, skipped: false };

    const payload = JSON.stringify(pushPayloadFromNotification(notification));

    let sent = 0;
    let dropped = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: PUSH_TTL_SECONDS }
          );
          sent += 1;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (pushSendOutcome(statusCode) === "drop") {
            // The subscription is retired: count it as dropped even if the row
            // cleanup fails, so the caller's view matches the push service's. A
            // failed delete leaves the row behind for the next send to retry.
            const { error: delError } = await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
            if (delError) {
              console.error("sendPushToTeacher delete stale:", sub.id, delError.message);
            }
            dropped += 1;
          } else {
            console.error(
              "sendPushToTeacher failed:",
              sub.id,
              statusCode ?? (err as { body?: string }).body ?? String(err)
            );
          }
        }
      })
    );

    return { sent, dropped, skipped: false };
  } catch (err) {
    // configureVapid() throws synchronously on a malformed VAPID_SUBJECT, key,
    // or subject — and any other unexpected fault lands here too. Push is a
    // second transport, so a self-hoster's typo must log and report nothing sent
    // rather than break the portal-cancel, RSVP and Stripe-webhook callers.
    console.error(
      "sendPushToTeacher aborted:",
      err instanceof Error ? err.message : String(err)
    );
    return { sent: 0, dropped: 0, skipped: "error" };
  }
}
