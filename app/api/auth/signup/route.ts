import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requiresBetaCode } from "@/lib/entitlements";
import { shouldProvisionTeacherFromSignup, signupEmailRedirectTo } from "@/lib/onboarding";
import { requestOrigin } from "@/lib/server/http";
import { ensureTeacherForAuthUser } from "@/lib/server/ensure-teacher";
import {
  BETA_GUESS_LIMIT,
  BETA_GUESS_WINDOW_MS,
  checkRateLimit,
  clientIpFromRequest,
  hitRateLimit,
} from "@/lib/rateLimit";
import { secureCompare } from "@/lib/server/secure-compare";

/**
 * Sign-up. When `requiresBetaCode()` (NEXT_PUBLIC_BETA_ONLY or BETA_ACCESS_CODE),
 * new accounts need the server-only access code. Self-hosters who leave both
 * unset get open sign-ups. Failed beta guesses are rate-limited per IP.
 *
 * The teachers row (with hosted trial fields) is created even when email
 * confirmation is still pending, so confirm-then-land-on-dashboard is not
 * stuck on a free/missing entitlement.
 */
export async function POST(req: NextRequest) {
  const { email, password, displayName, accessCode, timezone } =
    await req.json();

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

    if (
      typeof accessCode !== "string" ||
      !secureCompare(accessCode.trim(), requiredCode)
    ) {
      if (guessKey) hitRateLimit(guessKey, BETA_GUESS_WINDOW_MS);
      return NextResponse.json(
        {
          error:
            "Invalid access code. CogNote Studio is in private beta - join the waitlist and we'll be in touch.",
        },
        { status: 403 }
      );
    }
  }

  const supabase = await createClient();
  const timezoneValue = typeof timezone === "string" ? timezone : undefined;
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        ...(timezoneValue ? { timezone: timezoneValue } : {}),
      },
      emailRedirectTo: signupEmailRedirectTo(requestOrigin(req)),
    },
  });
  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  if (!shouldProvisionTeacherFromSignup(signUpData.user)) {
    // Duplicate email (dummy user) or missing user object. Same response as
    // "check your inbox" so we do not leak whether the address is taken.
    return NextResponse.json({ ok: true, needsConfirmation: true });
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign up did not return a user" },
      { status: 500 }
    );
  }

  // Create the teacher row before attempting sign-in. Production often
  // requires email confirmation, so sign-in fails and we used to return
  // early without a teachers row (missing trial → free limit banner).
  const serviceClient = createServiceClient();
  const ensured = await ensureTeacherForAuthUser(serviceClient, {
    userId,
    email,
    displayName:
      typeof displayName === "string" ? displayName : email.split("@")[0],
    timezone: typeof timezone === "string" ? timezone : null,
  });
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  // In local dev Supabase auto-confirms; sign in to establish the session.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return NextResponse.json({ ok: true, needsConfirmation: true });
  }

  return NextResponse.json({ ok: true });
}
