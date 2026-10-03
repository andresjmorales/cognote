"use client";

import { useCallback, useSyncExternalStore } from "react";

import { isIosBrowser } from "@/lib/pwa";

/**
 * iOS has no install prompt to hook into — beforeinstallprompt is Chromium
 * only — so the Share sheet is the only path, and this hint is the only
 * in-app install UI we ship. Hidden once the app is already installed, and
 * remembered when dismissed so it does not nag.
 *
 * Read through useSyncExternalStore so the server snapshot is "hidden" (no
 * hydration mismatch) and dismissal renders without effects, as in
 * PortalPolicyBanner.
 */

const DISMISSED_KEY = "cognote-ios-install-hint-dismissed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function readVisible(): boolean {
  try {
    if (window.localStorage.getItem(DISMISSED_KEY)) return false;
  } catch {
    // Storage unavailable (private mode): fall through and show the hint.
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIos = isIosBrowser({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    hasStandaloneProperty: "standalone" in nav,
  });
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  return isIos && !installed;
}

export function IosInstallHint() {
  const visible = useSyncExternalStore(subscribe, readVisible, () => false);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore storage failures; the hint simply reappears next visit.
    }
    notify();
  }, []);

  if (!visible) return null;

  // The separator lives here rather than in the caller. AccountMenu used to keep
  // its own bordered wrapper around this component, so on every platform that
  // never sees the hint the wrapper still rendered its border and padding, leaving
  // a stray divider and a blank gap directly above Sign out.
  return (
    <div className="border-t border-border mt-1 pt-1 px-3 py-2">
      <p className="flex items-start justify-between gap-2 text-xs text-muted">
        <span>
          Install CogNote: tap Share, then <strong>Add to Home Screen</strong>.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install instructions"
          className="shrink-0 p-2 -m-1 text-lg leading-none text-muted hover:text-foreground cursor-pointer"
        >
          ×
        </button>
      </p>
    </div>
  );
}
