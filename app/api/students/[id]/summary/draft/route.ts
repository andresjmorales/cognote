import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { getOrSeedDimensions } from "@/lib/server/skills";
import {
  draftStudentSummaryWithAi,
  type StudentSummaryContext,
} from "@/lib/ai/provider";
import { oneToOne } from "@/lib/schedule";
import { stripHtmlToText } from "@/lib/rich-text";
import { ageFromBirthdate } from "@/lib/students";
import { formatPracticeSince } from "@/lib/students-practice";

const WEAK_ITEM_LIMIT = 8;
const LESSON_NOTE_LIMIT = 8;
const MIN_ATTEMPTS_FOR_WEAK = 3;

function accuracyPct(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

function formatNoteDateLabel(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await getPolicy(supabase, user.id);
  if (policy.ai_provider === "none" || !policy.ai_api_key) {
    return NextResponse.json(
      {
        error:
          "Optional AI is not configured. Add a provider and key under Settings → Optional AI.",
      },
      { status: 400 }
    );
  }

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, name, level, birthdate, practice_start_date, teacher_notes"
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const [
    dimensions,
    { data: assessments },
    { data: lessons },
    { data: studentPlans },
    { data: lessonNoteRows },
  ] = await Promise.all([
    getOrSeedDimensions(supabase, user.id),
    supabase
      .from("skill_assessments")
      .select("dimension_id, rating, assessed_at")
      .eq("student_id", id)
      .order("assessed_at", { ascending: false }),
    supabase
      .from("lessons")
      .select("id, attendance ( status )")
      .eq("student_id", id)
      .eq("teacher_id", user.id),
    supabase
      .from("student_plans")
      .select(
        `
        practice_sessions (
          total_correct, total_incorrect, total_questions, completed_at,
          note_attempts ( note, symbol_id, is_correct )
        )
      `
      )
      .eq("student_id", id),
    supabase
      .from("lesson_notes")
      .select(
        `
        body, private_body, created_at,
        lessons!inner ( lesson_date, student_id )
      `
      )
      .eq("lessons.student_id", id)
      .order("created_at", { ascending: false })
      .limit(LESSON_NOTE_LIMIT),
  ]);

  const dimName = new Map(dimensions.map((d) => [d.id, d.name]));
  const latestByDim = new Map<
    string,
    { dimension: string; rating: number; assessedAt: string }
  >();
  for (const a of assessments ?? []) {
    if (latestByDim.has(a.dimension_id)) continue;
    const name = dimName.get(a.dimension_id);
    if (!name) continue;
    latestByDim.set(a.dimension_id, {
      dimension: name,
      rating: a.rating,
      assessedAt: a.assessed_at,
    });
  }

  let attended = 0;
  let studentCancel = 0;
  let teacherCancel = 0;
  let noShow = 0;
  let unmarked = 0;
  for (const lesson of lessons ?? []) {
    const att = oneToOne(lesson.attendance as { status: string } | { status: string }[] | null);
    if (!att) {
      unmarked++;
      continue;
    }
    switch (att.status) {
      case "attended":
        attended++;
        break;
      case "student_cancel":
        studentCancel++;
        break;
      case "teacher_cancel":
        teacherCancel++;
        break;
      case "no_show":
        noShow++;
        break;
      default:
        unmarked++;
    }
  }

  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalSessions = 0;
  const attemptMap = new Map<
    string,
    { label: string; correct: number; total: number }
  >();

  for (const sp of studentPlans ?? []) {
    const sessions = (sp.practice_sessions ?? []) as {
      total_correct: number | null;
      total_incorrect: number | null;
      total_questions: number | null;
      completed_at: string | null;
      note_attempts: {
        note: string | null;
        symbol_id: string | null;
        is_correct: boolean;
      }[];
    }[];
    for (const session of sessions) {
      if (!session.completed_at) continue;
      totalSessions++;
      totalCorrect += session.total_correct ?? 0;
      totalQuestions += session.total_questions ?? 0;
      for (const attempt of session.note_attempts ?? []) {
        const label = attempt.symbol_id || attempt.note;
        if (!label) continue;
        const entry = attemptMap.get(label) ?? {
          label,
          correct: 0,
          total: 0,
        };
        entry.total++;
        if (attempt.is_correct) entry.correct++;
        attemptMap.set(label, entry);
      }
    }
  }

  const weakItems = Array.from(attemptMap.values())
    .filter((e) => e.total >= MIN_ATTEMPTS_FOR_WEAK)
    .map((e) => ({
      label: e.label,
      accuracy: accuracyPct(e.correct, e.total),
      attempts: e.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, WEAK_ITEM_LIMIT);

  const recentLessonNotes = (lessonNoteRows ?? []).map((row) => {
    const lesson = oneToOne(
      row.lessons as
        | { lesson_date: string }
        | { lesson_date: string }[]
        | null
    );
    return {
      date: lesson?.lesson_date ?? row.created_at?.slice(0, 10) ?? "",
      familyNote: stripHtmlToText(row.body) || null,
      privateNote: stripHtmlToText(row.private_body) || null,
    };
  });

  const context: StudentSummaryContext = {
    name: student.name,
    ageYears: student.birthdate
      ? ageFromBirthdate(student.birthdate)
      : null,
    level: student.level,
    practiceSinceLabel: student.practice_start_date
      ? formatPracticeSince(student.practice_start_date)
      : null,
    noteDateLabel: formatNoteDateLabel(),
    existingPrivateNotes: stripHtmlToText(student.teacher_notes) || null,
    skills: Array.from(latestByDim.values()),
    attendance: {
      attended,
      studentCancel,
      teacherCancel,
      noShow,
      unmarked,
    },
    practice: {
      totalSessions,
      overallAccuracy:
        totalQuestions > 0 ? accuracyPct(totalCorrect, totalQuestions) : null,
      weakItems,
    },
    recentLessonNotes,
  };

  const result = await draftStudentSummaryWithAi({
    provider: policy.ai_provider,
    apiKey: policy.ai_api_key,
    context,
  });

  if (result.error && !result.summary) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    summary: result.summary,
    warning: result.error,
  });
}
