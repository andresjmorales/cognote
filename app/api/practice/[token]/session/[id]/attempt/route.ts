import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { id: sessionId } = await params;
  const body = await req.json();

  const { noteDisplayed, clef, correctAnswer, studentAnswer, isCorrect, responseTimeMs } =
    body;

  if (!noteDisplayed || !clef || !correctAnswer || !studentAnswer || typeof isCorrect !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: attemptError } = await supabase.from("note_attempts").insert({
    session_id: sessionId,
    note_displayed: noteDisplayed,
    clef,
    correct_answer: correctAnswer,
    student_answer: studentAnswer,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs ?? null,
  });

  if (attemptError) {
    console.error("Failed to record attempt:", attemptError);
    return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 });
  }

  // Fire-and-forget: update session tallies without blocking the response
  supabase
    .from("practice_sessions")
    .select("total_correct, total_incorrect, total_questions")
    .eq("id", sessionId)
    .single()
    .then(({ data: session }) => {
      if (!session) return;
      return supabase
        .from("practice_sessions")
        .update({
          total_correct: session.total_correct + (isCorrect ? 1 : 0),
          total_incorrect: session.total_incorrect + (isCorrect ? 0 : 1),
          total_questions: session.total_questions + 1,
        })
        .eq("id", sessionId);
    })
    .catch((err) => console.error("Failed to update session tallies:", err));

  return NextResponse.json({ ok: true });
}
