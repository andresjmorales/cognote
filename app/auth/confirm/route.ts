import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureTeacherForAuthUser } from "@/lib/server/ensure-teacher";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Lands Supabase auth email links (password recovery, email change
 * confirmations) and turns them into a session, then forwards to `next`.
 *
 * Handles both link styles: PKCE `?code=` (the default ConfirmationURL) and
 * `?token_hash=&type=` (used if the email templates are ever customized per
 * the Supabase SSR docs).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  // Same-origin relative paths only: "//evil.com" and "/\evil.com" are
  // treated as protocol-relative URLs by browsers.
  const next =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : "/dashboard";

  const redirectTo = req.nextUrl.clone();
  redirectTo.search = "";

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    ok = !error;
  }

  if (!ok) {
    redirectTo.pathname = "/login";
    redirectTo.searchParams.set(
      "message",
      "That link is invalid or has expired. Request a new one. (Password reset links must be opened in the same browser you requested them from.)"
    );
    return NextResponse.redirect(redirectTo);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    // Safety net: signup with email-confirm used to return before creating
    // the teachers row. Ensure it exists (hosted trial) via service role.
    const serviceClient = createServiceClient();
    const displayName =
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : null;
    await ensureTeacherForAuthUser(serviceClient, {
      userId: user.id,
      email: user.email,
      displayName,
    });

    await supabase
      .from("teachers")
      .update({ email: user.email })
      .eq("id", user.id)
      .neq("email", user.email);
  }

  redirectTo.pathname = next;
  return NextResponse.redirect(redirectTo);
}
