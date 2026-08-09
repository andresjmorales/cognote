import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  rejectIfTokenLookupsBlocked,
  recordTokenLookupFailure,
} from "@/lib/server/token-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id: sessionId } = await params;

  const blocked = rejectIfTokenLookupsBlocked(req);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { noteDisplayed, clef, correctAnswer, studentAnswer, isCorrect, responseTimeMs } =
    body as {
      noteDisplayed?: unknown;
      clef?: unknown;
      correctAnswer?: unknown;
      studentAnswer?: unknown;
      isCorrect?: unknown;
      responseTimeMs?: unknown;
    };

  if (
    typeof noteDisplayed !== "string" ||
    typeof clef !== "string" ||
    typeof correctAnswer !== "string" ||
    typeof studentAnswer !== "string" ||
    typeof isCorrect !== "boolean" ||
    !noteDisplayed ||
    !clef ||
    !correctAnswer ||
    !studentAnswer ||
    noteDisplayed.length > 100 ||
    correctAnswer.length > 100 ||
    studentAnswer.length > 100
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // The session must belong to the student plan this token resolves to;
  // session UUIDs alone are not authorization.
  const { data: session } = await supabase
    .from("practice_sessions")
    .select(
      "id, total_correct, total_incorrect, total_questions, student_plans!inner ( token, unassigned_at )"
    )
    .eq("id", sessionId)
    .single();

  const studentPlan = session?.student_plans as unknown as
    | { token: string; unassigned_at: string | null }
    | undefined;

  if (!session || !studentPlan || studentPlan.token !== token || studentPlan.unassigned_at) {
    recordTokenLookupFailure(req);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { error: attemptError } = await supabase.from("note_attempts").insert({
    session_id: sessionId,
    note_displayed: noteDisplayed,
    clef,
    correct_answer: correctAnswer,
    student_answer: studentAnswer,
    is_correct: isCorrect,
    response_time_ms: typeof responseTimeMs === "number" ? responseTimeMs : null,
  });

  if (attemptError) {
    console.error("Failed to record attempt:", attemptError);
    return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 });
  }

  await supabase
    .from("practice_sessions")
    .update({
      total_correct: session.total_correct + (isCorrect ? 1 : 0),
      total_incorrect: session.total_incorrect + (isCorrect ? 0 : 1),
      total_questions: session.total_questions + 1,
    })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
