import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const mode = body.mode as "lesson" | "free_practice" | "flashcard";

  if (!["lesson", "free_practice", "flashcard"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: sp } = await supabase
    .from("student_plans")
    .select("id")
    .eq("token", token)
    .single();

  if (!sp) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .insert({
      student_plan_id: sp.id,
      mode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
