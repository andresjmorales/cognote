import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark the first-run tour finished (or clear it so Help can replay).
 * Body: { completed: true } | { completed: false }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.completed !== "boolean") {
    return NextResponse.json(
      { error: "completed boolean required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("teachers")
    .update({
      onboarding_tour_completed_at: body.completed
        ? new Date().toISOString()
        : null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
