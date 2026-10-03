/**
 * Browser-side push helpers, kept out of lib/push.ts so that module stays free of
 * navigator/window/fetch and therefore unit-testable. Only import this from a
 * client component.
 */
import {
  PUSH_OWNER_STORAGE_KEY,
  shouldReleasePushForOwner,
} from "./push";

export function readPushOwner(): string | null {
  try {
    return window.localStorage.getItem(PUSH_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberPushOwner(teacherId: string): void {
  try {
    window.localStorage.setItem(PUSH_OWNER_STORAGE_KEY, teacherId);
  } catch {
    // Storage unavailable: push still works, it just cannot be released later.
  }
}

function forgetPushOwner(): void {
  try {
    window.localStorage.removeItem(PUSH_OWNER_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Drop this browser's push subscription and the server row pointing at it. Call
 * it while the session is still valid, because the DELETE is authenticated.
 * Best effort by design: it must never block a sign-out or a sign-in.
 */
export async function releasePushSubscription(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => undefined);
      }
    }
  } catch {
    // Ignore: releasing is opportunistic.
  } finally {
    forgetPushOwner();
  }
}

/** Release only when this browser's subscription belongs to another teacher. */
export async function releasePushIfOwnedByOther(
  currentTeacherId: string
): Promise<void> {
  if (!shouldReleasePushForOwner(readPushOwner(), currentTeacherId)) return;
  await releasePushSubscription();
}
