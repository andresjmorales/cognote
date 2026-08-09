import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for shared secrets (cron bearer token,
 * beta access code). Hashing first normalizes lengths so timingSafeEqual
 * never throws and length is not observable.
 */
export function secureCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
