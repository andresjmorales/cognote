import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureTeacherForAuthUser } from "@/lib/server/ensure-teacher";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { displayName, timezone } = await req.json();
  const serviceClient = createServiceClient();
  const tz = typeof timezone === "string" ? timezone : null;

  const { data: existing } = await serviceClient
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  // During private beta, teacher rows are only created via /api/auth/signup
  // (access code) or repaired on email confirm. This route must not be a
  // backdoor around the beta gate.
  if (!existing) {
    const { requiresBetaCode } = await import("@/lib/entitlements");
    if (requiresBetaCode()) {
      return NextResponse.json(
        {
          error:
            "CogNote Studio is in private beta. Sign up with an access code.",
        },
        { status: 403 }
      );
    }
  }

  const ensured = await ensureTeacherForAuthUser(serviceClient, {
    userId: user.id,
    email: user.email!,
    displayName:
      typeof displayName === "string"
        ? displayName
        : user.email?.split("@")[0] || "Teacher",
    timezone: tz,
  });

  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
