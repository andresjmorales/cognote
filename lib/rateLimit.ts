/**
 * Best-effort fixed-window rate limit (in-memory per server instance).
 * Fine for slowing beta-code guessing on Vercel; not a global distributed lock.
 */

export const BETA_GUESS_LIMIT = 10;
export const BETA_GUESS_WINDOW_MS = 15 * 60 * 1000;

type Bucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
    buckets.set(key, { count: 0, windowStartMs: nowMs });
    return { ok: true, remaining: limit };
  }
  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.windowStartMs + windowMs - nowMs) / 1000)
    );
    return { ok: false, retryAfterSec };
  }
  return { ok: true, remaining: limit - bucket.count };
}

/** Count one hit toward the window (call after a failed attempt). */
export function hitRateLimit(
  key: string,
  windowMs: number,
  nowMs: number = Date.now()
): void {
  const bucket = buckets.get(key);
  if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: nowMs });
    return;
  }
  bucket.count += 1;
}

/** Test helper — clears all buckets. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
