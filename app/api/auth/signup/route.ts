import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requiresBetaCode } from "@/lib/entitlements";
import {
  BETA_GUESS_LIMIT,
  BETA_GUESS_WINDOW_MS,
  checkRateLimit,
  clientIpFromRequest,
  hitRateLimit,
} from "@/lib/rateLimit";

/**
 * Sign-up. When `requiresBetaCode()` (NEXT_PUBLIC_BETA_ONLY or BETA_ACCESS_CODE),
 * new accounts need the server-only access code. Self-hosters who leave both
 * unset get open sign-ups. Failed beta guesses are rate-limited per IP.
 */
export async function POST(req: NextRequest) {
  const { email, password, displayName, accessCode } = await req.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const betaRequired = requiresBetaCode();
  const requiredCode = process.env.BETA_ACCESS_CODE?.trim();
  const guessKey = betaRequired
    ? `beta-guess:${clientIpFromRequest(req)}`
    : null;

  if (betaRequired) {
    if (!requiredCode) {
      console.error(
        "signup: NEXT_PUBLIC_BETA_ONLY requires BETA_ACCESS_CODE on the server"
      );
      return NextResponse.json(
        { error: "Beta signup is misconfigured. Contact support." },
        { status: 503 }
      );
    }

    if (guessKey) {
      const limited = checkRateLimit(
        guessKey,
        BETA_GUESS_LIMIT,
        BETA_GUESS_WINDOW_MS
      );
      if (!limited.ok) {
        return NextResponse.json(
          {
            error: `Too many access code attempts. Try again in ${limited.retryAfterSec}s.`,
          },
          { status: 429 }
        );
      }
    }

    if (typeof accessCode !== "string" || accessCode.trim() !== requiredCode) {
      if (guessKey) hitRateLimit(guessKey, BETA_GUESS_WINDOW_MS);
      return NextResponse.json(
        {
          error:
            "Invalid access code. CogNote Studio is in private beta — join the waitlist and we'll be in touch.",
        },
        { status: 403 }
      );
    }
  }

  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  // In local dev Supabase auto-confirms; sign in to establish the session.
  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });
  if (signInError) {
    // Most likely "email not confirmed" — account exists, session pending.
    return NextResponse.json({ ok: true, needsConfirmation: true });
  }

  const serviceClient = createServiceClient();
  const userId = signIn.user.id;
  const { data: existing } = await serviceClient
    .from("teachers")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    const { hostedSignupFields } = await import("@/lib/entitlements");
    const hosted = hostedSignupFields();
    const { error: teacherError } = await serviceClient.from("teachers").insert({
      id: userId,
      email,
      display_name: displayName || email.split("@")[0],
      hosted_plan: hosted.hosted_plan,
      trial_ends_at: hosted.trial_ends_at,
    });
    if (teacherError) {
      console.error("Failed to create teacher row:", teacherError);
      return NextResponse.json(
        { error: "Failed to set up account" },
        { status: 500 }
      );
    }
  }

  const { ensureStudioPolicyRow } = await import("@/lib/server/ensure-policy");
  await ensureStudioPolicyRow(serviceClient, userId);

  return NextResponse.json({ ok: true });
}
