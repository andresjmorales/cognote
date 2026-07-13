import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Beta-gated sign-up. When BETA_ACCESS_CODE is set, new accounts require the
 * code; self-hosters who leave it unset get open sign-ups. Runs entirely
 * server-side so the gate can't be skipped by calling Supabase directly from
 * the login page.
 */
export async function POST(req: NextRequest) {
  const { email, password, displayName, accessCode } = await req.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const requiredCode = process.env.BETA_ACCESS_CODE?.trim();
  if (requiredCode) {
    if (typeof accessCode !== "string" || accessCode.trim() !== requiredCode) {
      return NextResponse.json(
        { error: "Invalid access code. CogNote Studio is in private beta — join the waitlist and we'll be in touch." },
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
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
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
    const { error: teacherError } = await serviceClient.from("teachers").insert({
      id: userId,
      email,
      display_name: displayName || email.split("@")[0],
    });
    if (teacherError) {
      console.error("Failed to create teacher row:", teacherError);
      return NextResponse.json({ error: "Failed to set up account" }, { status: 500 });
    }
  }

  const { ensureStudioPolicyRow } = await import("@/lib/server/ensure-policy");
  await ensureStudioPolicyRow(serviceClient, userId);

  return NextResponse.json({ ok: true });
}
