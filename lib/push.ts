/**
 * Web Push helpers that hold no browser globals, so vitest's node environment
 * can cover them (vitest.config.ts is environment: "node", lib/**\/*.test.ts).
 * The DOM-facing calls stay in components/teacher/settings/PushNotificationToggle.
 */

/** 65-byte VAPID signatures and p256dh/auth keys arrive URL-safe base64. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** The payload is a JSON string in an encrypted frame; keep it small. */
export const PUSH_TITLE_MAX = 96;
export const PUSH_BODY_MAX = 180;

export function truncate(value: string, max: number): string {
  if (max <= 0) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export type PushPayload = {
  title: string;
  body: string;
  href: string;
  /** Only present when the payload was built from a known notification id. */
  tag?: string;
  /** When the EVENT happened (ms since epoch), not when the push was sent. */
  timestamp?: number;
};

export function pushPayloadFromNotification(n: {
  title: string;
  body?: string | null;
  href?: string | null;
  id?: string | null;
  /** The notification row's created_at (ISO, as Supabase returns a timestamptz). */
  createdAt?: string | null;
}): PushPayload {
  const payload: PushPayload = {
    title: truncate(n.title, PUSH_TITLE_MAX),
    body: truncate(n.body ?? "", PUSH_BODY_MAX),
    href: n.href ?? "/",
  };
  // The notification id is the natural tag: a re-delivered push (retry, or the
  // same event re-sent) REPLACES its own tray entry instead of stacking a
  // duplicate. No id means no tag key at all — an undefined-valued `tag` would
  // still be a tag to some clients.
  if (n.id) payload.tag = n.id;
  // The tray shows the time carried by Notification.timestamp, which defaults
  // to the moment the push ARRIVED. Because the push may be delayed up to
  // PUSH_TTL_SECONDS, send the row's created_at (the event time) instead.
  // Date.parse yields NaN for garbage and JSON.stringify turns NaN into null
  // — a bogus timestamp — so the guard is Number.isFinite, not truthiness. An
  // unparseable value is dropped and the client falls back to its default.
  const eventMs = n.createdAt ? Date.parse(n.createdAt) : NaN;
  if (Number.isFinite(eventMs)) payload.timestamp = eventMs;
  return payload;
}

/**
 * True when a subscribe upsert failed only because this endpoint already
 * belongs to another teacher. RLS hides that row, so the DO UPDATE cannot fire
 * and the INSERT trips the policy's WITH CHECK — Postgres reports 42501 for the
 * route's upsert. 23505 is the plain-insert variant of the same collision.
 */
export function isPushSubscribeConflict(code?: string | null): boolean {
  return code === "42501" || code === "23505";
}

/** Only the three fields the server needs ever leave the device. */
export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function subscriptionToPayload(sub: PushSubscription): PushSubscriptionPayload {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export type PushSupport =
  | "unsupported" // no serviceWorker / PushManager / Notification
  | "install-first" // iOS Safari: push only exists in an installed PWA (16.4+)
  | "denied" // Notification.permission === "denied"
  | "available";

/**
 * Ordered: capability first, then the iOS install prerequisite, then the
 * permission verdict. iOS is checked before "denied" because a not-yet-installed
 * iOS app reports permission "default" and the install hint is the more useful
 * instruction (push exists only in a home-screen app on 16.4+).
 */
export function pushSupportState(signals: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIos: boolean;
  standalone: boolean;
  permission: NotificationPermission;
}): PushSupport {
  if (
    !signals.hasServiceWorker ||
    !signals.hasPushManager ||
    !signals.hasNotification
  ) {
    return "unsupported";
  }
  if (signals.isIos && !signals.standalone) return "install-first";
  if (signals.permission === "denied") return "denied";
  return "available";
}

/** A VAPID public key is a 65-byte uncompressed P-256 point, base64url-encoded
 *  (~87 characters). Decoding is the only honest check: a length threshold of
 *  the right order accepts any garbage of the same length, and the failure would
 *  otherwise surface as an opaque pushManager.subscribe() rejection in a browser
 *  the teacher is holding. */
export function hasVapidPublicKey(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return urlBase64ToUint8Array(value).length === 65;
  } catch {
    // Not base64 at all.
    return false;
  }
}

/**
 * Push services an endpoint may come from. A push endpoint is stored and later
 * POSTed to by the server, so an attacker-controlled host here is an SSRF
 * surface. Matching is on exact DNS label boundaries — never substrings — so
 * `evilfcm.googleapis.com` and `fcm.googleapis.com.attacker.net` are both
 * rejected. Validating the NAME is what makes this immune to DNS rebinding: an
 * IP or private-range check would have to resolve first and is then
 * time-of-check/time-of-use vulnerable.
 *
 * Self-hosters running a non-standard push service can extend this with the
 * PUSH_ENDPOINT_HOSTS_EXTRA environment variable (comma-separated).
 */
export const DEFAULT_PUSH_ENDPOINT_HOSTS = [
  "fcm.googleapis.com", // Chrome/Edge/Opera on Android, Chrome on desktop
  "notify.windows.com", // Edge/Windows (WNS)
  "push.services.mozilla.com", // Firefox, incl. updates.push.services.mozilla.com
  "push.apple.com", // Safari, incl. web.push.apple.com
] as const;

function hostMatches(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase();
  const base = allowed.toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}

/** True for an https endpoint belonging to a known push service. */
export function isAllowedPushEndpoint(
  endpoint: string,
  extraHosts: readonly string[] = []
): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return [...DEFAULT_PUSH_ENDPOINT_HOSTS, ...extraHosts].some((allowed) =>
    hostMatches(url.hostname, allowed)
  );
}

/** localStorage key recording which teacher enabled push on this browser. */
export const PUSH_OWNER_STORAGE_KEY = "cognote-push-owner";

/**
 * Whether a subscription that is already on this browser must be released
 * because a different teacher is now signing in.
 *
 * A null `stored` means the browser holds a subscription nobody claimed — one
 * created before this marker existed. That is deliberately treated as "keep":
 * releasing on an unknown owner would silently kill push for a teacher who
 * merely signed back in, and the mismatch case is the one that leaks.
 */
export function shouldReleasePushForOwner(
  stored: string | null,
  current: string
): boolean {
  return Boolean(stored && current && stored !== current);
}
