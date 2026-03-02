import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .eq("teacher_id", user.id);

  const { data: plans } = await supabase
    .from("plans")
    .select("id")
    .eq("teacher_id", user.id);

  const studentIds = (students ?? []).map((s) => s.id);

  let recentSessions: any[] = [];
  if (studentIds.length > 0) {
    const { data: sps } = await supabase
      .from("student_plans")
      .select("id")
      .in("student_id", studentIds);

    const spIds = (sps ?? []).map((sp) => sp.id);

    if (spIds.length > 0) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data } = await supabase
        .from("practice_sessions")
        .select("id, started_at, total_correct, total_questions")
        .in("student_plan_id", spIds)
        .gte("started_at", weekAgo.toISOString());

      recentSessions = data ?? [];
    }
  }

  const totalCorrect = recentSessions.reduce(
    (sum, s) => sum + s.total_correct,
    0
  );
  const totalQuestions = recentSessions.reduce(
    (sum, s) => sum + s.total_questions,
    0
  );

  return NextResponse.json({
    studentCount: students?.length ?? 0,
    planCount: plans?.length ?? 0,
    sessionsThisWeek: recentSessions.length,
    weeklyAccuracy:
      totalQuestions > 0
        ? Math.round((totalCorrect / totalQuestions) * 100)
        : null,
  });
}
