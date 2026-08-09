import { NextResponse } from "next/server";
import {
  checkRateLimit,
  hitRateLimit,
  clientIpFromRequest,
  TOKEN_LOOKUP_FAIL_LIMIT,
  TOKEN_LOOKUP_FAIL_WINDOW_MS,
} from "@/lib/rateLimit";

/**
 * Brute-force guard for the public token routes (practice links, portal
 * calendar). Call `rejectIfTokenLookupsBlocked` before resolving a token and
 * `recordTokenLookupFailure` whenever a lookup misses. Successful lookups
 * never count toward the limit, so real students and families are unaffected.
 */
export function rejectIfTokenLookupsBlocked(req: Request): NextResponse | null {
  const result = checkRateLimit(
    tokenLookupKey(req),
    TOKEN_LOOKUP_FAIL_LIMIT,
    TOKEN_LOOKUP_FAIL_WINDOW_MS
  );
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}

export function recordTokenLookupFailure(req: Request): void {
  hitRateLimit(tokenLookupKey(req), TOKEN_LOOKUP_FAIL_WINDOW_MS);
}

function tokenLookupKey(req: Request): string {
  return `token-lookup:${clientIpFromRequest(req)}`;
}
