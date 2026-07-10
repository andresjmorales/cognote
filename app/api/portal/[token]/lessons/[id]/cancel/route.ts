import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { createTeacherNotification } from "@/lib/server/notifications";
import {
  formatLessonDate,
  formatLessonTime,
} from "@/lib/schedule";
import { requestOrigin } from "@/lib/server/http";
import type { AttendanceStatus } from "@/lib/supabase/types";

/**
 * Family portal: cancel an upcoming lesson with an optional note.
 * Sets student_cancel + notice_at = now for billability / make-ups.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id: lessonId } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, name, family_name, teacher_id, students ( id, name )")
    .eq("portal_token", token)
    .single();

  if (!guardian) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const students = (guardian.students ?? []) as { id: string; name: string }[];
  const studentIds = new Set(students.map((s) => s.id));

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, student_id, starts_at, duration_minutes, teacher_id, attendance!lesson_id ( status )"
    )
    .eq("id", lessonId)
    .eq("teacher_id", guardian.teacher_id)
    .single();

  if (!lesson || !studentIds.has(lesson.student_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date(lesson.starts_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Only upcoming lessons can be cancelled from the portal" },
      { status: 400 }
    );
  }

  const existing = Array.isArray(lesson.attendance)
    ? lesson.attendance[0]
    : lesson.attendance;
  const status = (existing as { status: AttendanceStatus } | null)?.status;
  if (status === "student_cancel" || status === "teacher_cancel") {
    return NextResponse.json({ error: "Lesson is already cancelled" }, { status: 400 });
  }
  if (status === "attended" || status === "no_show") {
    return NextResponse.json(
      { error: "This lesson already has attendance marked" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const cancelNote =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const noticeAt = new Date().toISOString();

  const { error } = await supabase.from("attendance").upsert(
    {
      lesson_id: lessonId,
      status: "student_cancel",
      notice_at: noticeAt,
      cancel_note: cancelNote,
      marked_at: noticeAt,
    },
    { onConflict: "lesson_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const policy = await getPolicy(supabase, guardian.teacher_id);
  const studentName =
    students.find((s) => s.id === lesson.student_id)?.name ?? "Student";
  const when = `${formatLessonDate(lesson.starts_at, policy.timezone, "long")} at ${formatLessonTime(lesson.starts_at, policy.timezone)}`;
  const origin = requestOrigin(req);
  const href = `/schedule`;

  await createTeacherNotification(supabase, {
    teacherId: guardian.teacher_id,
    type: "portal_cancel",
    title: `${studentName}'s lesson cancelled`,
    body: [
      `${studentName} — ${when}`,
      cancelNote ? `Note: ${cancelNote}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    href,
    origin,
    policy,
  });

  return NextResponse.json({ ok: true, noticeAt });
}
