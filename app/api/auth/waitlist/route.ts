import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  hitRateLimit,
  clientIpFromRequest,
  WAITLIST_LIMIT,
  WAITLIST_WINDOW_MS,
} from "@/lib/rateLimit";

/** Linear-time email shape check (avoids ReDoS-prone regex on public input). */
function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  if (email.length === 0 || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1) {
    return false;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || local.includes(" ") || domain.includes(" ")) {
    return false;
  }
  const dot = domain.lastIndexOf(".");
  if (dot <= 0 || dot === domain.length - 1) return false;
  return !domain.split(".").some((label) => label.length === 0);
}

/** Public waitlist sign-up for people without a beta access code. */
export async function POST(req: NextRequest) {
  const rateKey = `waitlist:${clientIpFromRequest(req)}`;
  const rate = checkRateLimit(rateKey, WAITLIST_LIMIT, WAITLIST_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many signups from this address. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }
  hitRateLimit(rateKey, WAITLIST_WINDOW_MS);

  const { email } = await req.json();

  if (typeof email !== "string" || !isPlausibleEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("waitlist")
    .upsert(
      { email: email.trim().toLowerCase() },
      { onConflict: "email", ignoreDuplicates: true }
    );

  if (error) {
    console.error("Waitlist insert failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
