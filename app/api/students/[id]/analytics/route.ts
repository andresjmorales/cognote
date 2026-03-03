import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify student belongs to teacher
  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { data: studentPlans } = await supabase
    .from("student_plans")
    .select("id")
    .eq("student_id", studentId);

  const spIds = (studentPlans ?? []).map((sp) => sp.id);

  if (spIds.length === 0) {
    return NextResponse.json({
      student,
      totalSessions: 0,
      totalQuestions: 0,
      overallAccuracy: null,
      noteAccuracy: {},
      sessions: [],
    });
  }

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("*")
    .in("student_plan_id", spIds)
    .order("started_at", { ascending: false });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: attempts } = sessionIds.length > 0
    ? await supabase
        .from("note_attempts")
        .select("note_displayed, is_correct, response_time_ms")
        .in("session_id", sessionIds)
    : { data: [] as any[] };

  // Compute note accuracy
  const noteAccuracy: Record<
    string,
    { correct: number; total: number; avgTime: number }
  > = {};
  (attempts ?? []).forEach((a) => {
    if (!noteAccuracy[a.note_displayed]) {
      noteAccuracy[a.note_displayed] = { correct: 0, total: 0, avgTime: 0 };
    }
    noteAccuracy[a.note_displayed].total++;
    if (a.is_correct) noteAccuracy[a.note_displayed].correct++;
    if (a.response_time_ms) {
      noteAccuracy[a.note_displayed].avgTime += a.response_time_ms;
    }
  });

  Object.values(noteAccuracy).forEach((stats) => {
    if (stats.total > 0) stats.avgTime = Math.round(stats.avgTime / stats.total);
  });

  const totalCorrect = (sessions ?? []).reduce(
    (sum, s) => sum + s.total_correct,
    0
  );
  const totalQuestions = (sessions ?? []).reduce(
    (sum, s) => sum + s.total_questions,
    0
  );

  return NextResponse.json({
    student,
    totalSessions: sessions?.length ?? 0,
    totalQuestions,
    overallAccuracy:
      totalQuestions > 0
        ? Math.round((totalCorrect / totalQuestions) * 100)
        : null,
    noteAccuracy,
    sessions: (sessions ?? []).slice(0, 20),
  });
}
