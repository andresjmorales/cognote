import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientVapidPublicKey,
  isPushConfigured,
  PUSH_TTL_SECONDS,
  pushSendOutcome,
  sendPushToTeacher,
} from "./push";

// Only the pure predicates are unit-tested here. sendPushToTeacher talks to the
// web-push library and Postgres, so it has no home in a node unit test; it is
// exercised by the device checklist instead.
describe("pushSendOutcome", () => {
  it("drops a subscription the push service has retired", () => {
    expect(pushSendOutcome(404)).toBe("drop");
    expect(pushSendOutcome(410)).toBe("drop");
  });

  it("fails anything else so the row is kept", () => {
    expect(pushSendOutcome(400)).toBe("fail");
    expect(pushSendOutcome(500)).toBe("fail");
    expect(pushSendOutcome(undefined)).toBe("fail");
  });
});

describe("isPushConfigured", () => {
  it("is false unless BOTH keys are present", () => {
    expect(isPushConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isPushConfigured({ VAPID_PUBLIC_KEY: "pub" } as unknown as NodeJS.ProcessEnv)
    ).toBe(false);
    expect(isPushConfigured({ VAPID_PRIVATE_KEY: "priv" } as unknown as NodeJS.ProcessEnv)).toBe(
      false
    );
  });

  it("is true when both keys are present", () => {
    expect(
      isPushConfigured({
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});

// A genuine 65-byte uncompressed P-256 point, base64url-encoded. The runtime
// key served to the browser must be this shape, so the fixture is real, not a
// stand-in length.
const REAL_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

describe("clientVapidPublicKey", () => {
  it("returns the public key when both keys are set and it decodes to 65 bytes", () => {
    expect(
      clientVapidPublicKey({
        VAPID_PUBLIC_KEY: REAL_VAPID_KEY,
        VAPID_PRIVATE_KEY: "priv",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(REAL_VAPID_KEY);
  });

  it("returns null when VAPID_PRIVATE_KEY is absent", () => {
    // Without the private half the server cannot send, so the browser must not
    // be handed a key and the control must stay hidden.
    expect(
      clientVapidPublicKey({
        VAPID_PUBLIC_KEY: REAL_VAPID_KEY,
      } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
  });

  it("returns null for a malformed public key even when both are set", () => {
    expect(
      clientVapidPublicKey({
        VAPID_PUBLIC_KEY: "not-base64!",
        VAPID_PRIVATE_KEY: "priv",
      } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
    // Base64, but 15 bytes rather than the required 65.
    expect(
      clientVapidPublicKey({
        VAPID_PUBLIC_KEY: "A".repeat(21),
        VAPID_PRIVATE_KEY: "priv",
      } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
  });
});

// The value is a product decision, but it must stay bounded: the bug this
// guards is someone "fixing" it back to web-push's four-week default, which
// would surface long-stale alerts.
describe("PUSH_TTL_SECONDS", () => {
  it("bounds staleness to well under a day", () => {
    expect(PUSH_TTL_SECONDS).toBeGreaterThan(0);
    expect(PUSH_TTL_SECONDS).toBeLessThanOrEqual(6 * 60 * 60);
  });
});

// sendPushToTeacher is awaited by the portal-cancel, RSVP and Stripe-webhook
// flows, so it must never throw: a self-hoster with a malformed VAPID value must
// not break them. web-push validates the subject synchronously, so a non-URL
// VAPID_SUBJECT reproduces the crash with no network involved.
describe("sendPushToTeacher", () => {
  const savedEnv = { ...process.env };
  const VAPID_KEYS = [
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ] as const;

  afterEach(() => {
    for (const key of VAPID_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("reports the send aborted when VAPID is present but malformed", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "not-a-url";

    // Both keys are set, so this is NOT the unconfigured short-circuit: it
    // reaches configureVapid(), which throws on the bad subject, and the
    // catch-all reports "error".
    await expect(
      sendPushToTeacher({} as unknown as SupabaseClient, "teacher-1", {
        title: "Lesson cancelled",
      })
    ).resolves.toEqual({ sent: 0, dropped: 0, skipped: "error" });
  });

  it("reports unconfigured when no VAPID keys are set", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    await expect(
      sendPushToTeacher({} as unknown as SupabaseClient, "teacher-1", {
        title: "Lesson cancelled",
      })
    ).resolves.toEqual({ sent: 0, dropped: 0, skipped: "unconfigured" });
  });
});
