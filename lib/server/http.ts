import type { NextRequest } from "next/server";

/**
 * Absolute origin for links in outbound email, honoring reverse-proxy
 * headers (Vercel and most self-host setups set x-forwarded-*).
 */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}
