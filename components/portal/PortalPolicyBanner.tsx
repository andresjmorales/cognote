"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * One-time "studio policies were updated" notice. Dismissal is stored in
 * localStorage per portal token, so the banner reappears only when
 * policies_updated_at moves past the stored marker. No server state needed.
 *
 * Read through useSyncExternalStore so the server snapshot is "hidden"
 * (no hydration mismatch) and dismissal updates render without effects.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function readVisible(storageKey: string, policiesUpdatedAt: string): boolean {
  try {
    const seen = window.localStorage.getItem(storageKey);
    return !seen || new Date(seen) < new Date(policiesUpdatedAt);
  } catch {
    // Storage unavailable (private mode): just show the banner.
    return true;
  }
}

export function PortalPolicyBanner({
  token,
  policiesUpdatedAt,
}: {
  token: string;
  policiesUpdatedAt: string;
}) {
  const storageKey = `cognote-policies-seen-${token}`;
  const visible = useSyncExternalStore(
    subscribe,
    () => readVisible(storageKey, policiesUpdatedAt),
    () => false
  );

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, policiesUpdatedAt);
    } catch {
      // Ignore storage failures; the banner simply reappears next visit.
    }
    notify();
  }, [storageKey, policiesUpdatedAt]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-3"
    >
      <p className="text-sm">
        <span className="font-semibold">Studio policies were updated.</span>{" "}
        <a href="#studio-policies" className="text-primary hover:underline">
          See the current policies
        </a>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted hover:text-foreground text-lg leading-none cursor-pointer"
      >
        ×
      </button>
    </div>
  );
}
