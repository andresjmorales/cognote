import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: sp } = await supabase
    .from("student_plans")
    .select("id, plans ( notes, clef )")
    .eq("token", token)
    .single();

  if (!sp) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const { data: progress } = await supabase
    .from("flashcard_progress")
    .select("*")
    .eq("student_plan_id", sp.id);

  return NextResponse.json({
    studentPlanId: sp.id,
    plan: sp.plans,
    progress: progress ?? [],
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { note, clef, easeFactor, intervalDays, repetitions, nextReview } = body;

  const supabase = createServiceClient();

  const { data: sp } = await supabase
    .from("student_plans")
    .select("id")
    .eq("token", token)
    .single();

  if (!sp) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const { error } = await supabase
    .from("flashcard_progress")
    .upsert(
      {
        student_plan_id: sp.id,
        note,
        clef,
        ease_factor: easeFactor,
        interval_days: intervalDays,
        repetitions,
        next_review: nextReview,
        last_reviewed: new Date().toISOString(),
      },
      { onConflict: "student_plan_id,note,clef" }
    );

  if (error) {
    console.error("Failed to update flashcard progress:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
