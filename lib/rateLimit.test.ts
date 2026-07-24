import { describe, it, expect, beforeEach } from "vitest";
import {
  BETA_GUESS_LIMIT,
  BETA_GUESS_WINDOW_MS,
  checkRateLimit,
  hitRateLimit,
  resetRateLimitBuckets,
} from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("allows up to the limit then blocks", () => {
    const key = "beta-guess:1.2.3.4";
    const now = 1_000_000;
    for (let i = 0; i < BETA_GUESS_LIMIT; i++) {
      expect(checkRateLimit(key, BETA_GUESS_LIMIT, BETA_GUESS_WINDOW_MS, now).ok).toBe(
        true
      );
      hitRateLimit(key, BETA_GUESS_WINDOW_MS, now);
    }
    const blocked = checkRateLimit(
      key,
      BETA_GUESS_LIMIT,
      BETA_GUESS_WINDOW_MS,
      now
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("resets after the window", () => {
    const key = "beta-guess:reset";
    const now = 1_000_000;
    for (let i = 0; i < BETA_GUESS_LIMIT; i++) {
      hitRateLimit(key, BETA_GUESS_WINDOW_MS, now);
    }
    expect(
      checkRateLimit(key, BETA_GUESS_LIMIT, BETA_GUESS_WINDOW_MS, now).ok
    ).toBe(false);
    expect(
      checkRateLimit(
        key,
        BETA_GUESS_LIMIT,
        BETA_GUESS_WINDOW_MS,
        now + BETA_GUESS_WINDOW_MS
      ).ok
    ).toBe(true);
  });
});
