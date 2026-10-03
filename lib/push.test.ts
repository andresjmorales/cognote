import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PUSH_BODY_MAX,
  PUSH_OWNER_STORAGE_KEY,
  PUSH_TITLE_MAX,
  hasVapidPublicKey,
  isAllowedPushEndpoint,
  isPushSubscribeConflict,
  pushPayloadFromNotification,
  pushSupportState,
  shouldReleasePushForOwner,
  subscriptionToPayload,
  truncate,
  urlBase64ToUint8Array,
} from "./push";

describe("urlBase64ToUint8Array", () => {
  it("decodes a URL-safe base64 string without padding", () => {
    // "hello" -> base64 "aGVsbG8=" -> url-safe, padding stripped
    expect(Array.from(urlBase64ToUint8Array("aGVsbG8"))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it("translates - and _ back to + and /", () => {
    // 0xfb 0xff 0xbf -> base64 "+/+/" -> url-safe "-_-_"
    expect(Array.from(urlBase64ToUint8Array("-_-_"))).toEqual([251, 255, 191]);
  });

  it("handles a real 65-byte VAPID public key", () => {
    const key =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});

describe("truncate", () => {
  it("leaves short strings alone", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("cuts to the limit and marks the cut", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("returns an empty string for a non-positive budget", () => {
    expect(truncate("abc", 0)).toBe("");
    expect(truncate("abc", -1)).toBe("");
  });
});

describe("pushPayloadFromNotification", () => {
  it("carries title, body and href for the worker", () => {
    expect(
      pushPayloadFromNotification({
        title: "Lesson cancelled",
        body: "Mia, Tue 4pm",
        href: "/schedule",
      })
    ).toEqual({ title: "Lesson cancelled", body: "Mia, Tue 4pm", href: "/schedule" });
  });

  it("defaults a missing body and href", () => {
    expect(pushPayloadFromNotification({ title: "Paid" })).toEqual({
      title: "Paid",
      body: "",
      href: "/",
    });
  });

  it("bounds the lengths so a long note cannot blow the payload limit", () => {
    const payload = pushPayloadFromNotification({
      title: "t".repeat(500),
      body: "b".repeat(500),
    });
    expect(payload.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
    expect(payload.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
  });

  it("uses the notification id as the tag so a re-delivery replaces", () => {
    const payload = pushPayloadFromNotification({
      id: "notif-123",
      title: "Lesson cancelled",
      body: "Mia, Tue 4pm",
      href: "/schedule",
    });
    expect(payload.tag).toBe("notif-123");
    expect(payload).toEqual({
      title: "Lesson cancelled",
      body: "Mia, Tue 4pm",
      href: "/schedule",
      tag: "notif-123",
    });
  });

  it("omits the tag key entirely when there is no id", () => {
    // Not merely undefined: a present `tag: undefined` still counts as a tag to
    // some clients, which would collapse unrelated notifications together.
    const payload = pushPayloadFromNotification({ title: "Paid" });
    expect("tag" in payload).toBe(false);
    expect(Object.keys(payload)).not.toContain("tag");
  });

  it("omits the tag for a null id too", () => {
    const payload = pushPayloadFromNotification({ title: "Paid", id: null });
    expect("tag" in payload).toBe(false);
  });

  it("stamps the event time from createdAt as epoch milliseconds", () => {
    const payload = pushPayloadFromNotification({
      id: "notif-123",
      title: "Lesson cancelled",
      body: "Mia, Tue 4pm",
      href: "/schedule",
      createdAt: "2026-08-07T12:00:00.000Z",
    });
    // 2026-08-07T12:00:00.000Z stated explicitly, not just "is a number", so a
    // change in how the ISO string is parsed is caught rather than hidden.
    expect(payload.timestamp).toBe(1786104000000);
    expect(payload).toEqual({
      title: "Lesson cancelled",
      body: "Mia, Tue 4pm",
      href: "/schedule",
      tag: "notif-123",
      timestamp: 1786104000000,
    });
  });

  it("omits the timestamp key when createdAt is null, undefined or unparseable", () => {
    // An unparseable value is worse than none: Date.parse yields NaN, which
    // JSON.stringify would serialise as null — a bogus timestamp — so the guard
    // drops it and the client falls back to its own default.
    expect(
      "timestamp" in pushPayloadFromNotification({ title: "Paid", createdAt: null })
    ).toBe(false);
    expect(
      "timestamp" in pushPayloadFromNotification({ title: "Paid", createdAt: undefined })
    ).toBe(false);
    expect(
      "timestamp" in pushPayloadFromNotification({ title: "Paid", createdAt: "not-a-date" })
    ).toBe(false);
    expect(
      "timestamp" in pushPayloadFromNotification({ title: "Paid", createdAt: "" })
    ).toBe(false);
  });
});

describe("isPushSubscribeConflict", () => {
  it("treats the RLS upsert rejection and the plain-insert unique clash as conflicts", () => {
    expect(isPushSubscribeConflict("42501")).toBe(true);
    expect(isPushSubscribeConflict("23505")).toBe(true);
  });

  it("ignores absent codes", () => {
    expect(isPushSubscribeConflict(undefined)).toBe(false);
    expect(isPushSubscribeConflict(null)).toBe(false);
  });

  it("does not treat an unrelated Postgres or PostgREST code as a conflict", () => {
    expect(isPushSubscribeConflict("23503")).toBe(false);
    expect(isPushSubscribeConflict("PGRST301")).toBe(false);
  });
});

describe("pushSupportState", () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    isIos: false,
    standalone: false,
    permission: "default" as const,
  };

  it("reports unsupported when the platform lacks the APIs", () => {
    expect(pushSupportState({ ...base, hasPushManager: false })).toBe("unsupported");
    expect(pushSupportState({ ...base, hasServiceWorker: false })).toBe("unsupported");
    expect(pushSupportState({ ...base, hasNotification: false })).toBe("unsupported");
  });

  it("tells iOS users to install first, before it mentions permission", () => {
    expect(pushSupportState({ ...base, isIos: true })).toBe("install-first");
    expect(pushSupportState({ ...base, isIos: true, standalone: true })).toBe("available");
  });

  it("reports denied, and available otherwise", () => {
    expect(pushSupportState({ ...base, permission: "denied" })).toBe("denied");
    expect(pushSupportState({ ...base, permission: "granted" })).toBe("available");
    expect(pushSupportState(base)).toBe("available");
  });

  it("reports denied for an installed iOS app, but install-first for iOS Safari", () => {
    // The precedence the module documents: an installed app with a denied
    // permission IS denied; a browser that is not installed yet cannot get
    // push at all on iOS, so the install instruction is the useful one.
    expect(
      pushSupportState({ ...base, isIos: true, standalone: true, permission: "denied" })
    ).toBe("denied");
    expect(
      pushSupportState({ ...base, isIos: true, standalone: false, permission: "denied" })
    ).toBe("install-first");
  });
});

const REAL_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

describe("hasVapidPublicKey", () => {
  it("accepts a real 65-byte base64url key", () => {
    expect(hasVapidPublicKey(REAL_VAPID_KEY)).toBe(true);
  });

  it("rejects missing, empty and malformed values", () => {
    expect(hasVapidPublicKey(undefined)).toBe(false);
    expect(hasVapidPublicKey("")).toBe(false);
    expect(hasVapidPublicKey("not-a-key")).toBe(false);
    expect(hasVapidPublicKey("!!!not base64!!!")).toBe(false);
  });

  it("rejects a wrongly-sized key that a bare length gate would accept", () => {
    // 21 base64url chars decodes to 15 bytes, not 65.
    expect(hasVapidPublicKey("A".repeat(21))).toBe(false);
  });
});

describe("subscriptionToPayload", () => {
  it("passes through only the endpoint and the two keys", () => {
    const sub = {
      endpoint: "https://push.example.com/abc",
      toJSON: () => ({
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "pkey", auth: "akey" },
      }),
    } as unknown as PushSubscription;

    expect(subscriptionToPayload(sub)).toEqual({
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "pkey", auth: "akey" },
    });
  });

  it("serialises absent keys as empty strings, which the API route rejects", () => {
    // /api/push/subscribe validates keys with zod .min(1), so an empty key is
    // refused with a 400 rather than stored. Pinning it here documents that the
    // guard lives on the server, not in this helper.
    const sub = {
      endpoint: "https://push.example.com/abc",
      toJSON: () => ({ endpoint: "https://push.example.com/abc" }),
    } as unknown as PushSubscription;

    expect(subscriptionToPayload(sub).keys).toEqual({ p256dh: "", auth: "" });
  });
});

// The worker cannot import lib/push (plain JS, no bundler), so its handlers are
// pinned by reading the file — the same drift guard lib/pwa.test.ts uses for
// CACHE_EXCLUDED_PATTERN.
describe("service worker push handlers", () => {
  it("handles push and notificationclick", () => {
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain("showNotification(");
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("clients.openWindow");
  });
});

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push service hosts", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(
      isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")
    ).toBe(true);
    expect(
      isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")
    ).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGxhbA")).toBe(true);
  });

  it("rejects a host that is not a push service", () => {
    expect(isAllowedPushEndpoint("https://evil.example.com/x")).toBe(false);
  });

  it("requires https, so link-local metadata services are out", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(
      isAllowedPushEndpoint("http://169.254.169.254/latest/meta-data/")
    ).toBe(false);
  });

  it("matches on label boundaries, not substrings", () => {
    expect(isAllowedPushEndpoint("https://evilfcm.googleapis.com/x")).toBe(false);
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com.attacker.net/x")
    ).toBe(false);
    expect(
      isAllowedPushEndpoint("https://notify.windows.com.attacker.net/x")
    ).toBe(false);
  });

  it("honours extra hosts, still on label boundaries", () => {
    expect(isAllowedPushEndpoint("https://push.my-studio.dev/x", ["my-studio.dev"])).toBe(true);
    expect(isAllowedPushEndpoint("https://evilmy-studio.dev/x", ["my-studio.dev"])).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });
});

describe("shouldReleasePushForOwner", () => {
  it("keeps the subscription when the same teacher signs back in", () => {
    // The common case: a teacher returns to a device they already enabled push
    // on. Releasing here would silently turn their alerts off.
    expect(shouldReleasePushForOwner("teacher-a", "teacher-a")).toBe(false);
  });

  it("releases the subscription when a different teacher signs in", () => {
    // The leak: this browser holds teacher A's subscription and RLS hides A's
    // row from teacher B, so nothing else can ever delete it.
    expect(shouldReleasePushForOwner("teacher-a", "teacher-b")).toBe(true);
  });

  it("keeps a subscription that no teacher ever claimed", () => {
    // A subscription created before this marker existed has an unknown owner;
    // releasing on an unknown owner would kill push for a legitimate teacher.
    expect(shouldReleasePushForOwner(null, "teacher-b")).toBe(false);
  });

  it("keeps the subscription when the current teacher id is empty", () => {
    // No current id means a mismatch cannot be proven, so do not release.
    expect(shouldReleasePushForOwner("teacher-a", "")).toBe(false);
  });

  it("pins the storage key so a rename cannot silently strand ownership", () => {
    // Mirrors the THEME_COOKIE guard: written under one key and read under
    // another, ownership would never be released again.
    expect(PUSH_OWNER_STORAGE_KEY).toBe("cognote-push-owner");
  });
});
