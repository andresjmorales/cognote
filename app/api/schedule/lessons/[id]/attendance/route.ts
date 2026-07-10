import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveStudentCancelNoticeAt,
  type StudentCancelNoticeChoice,
} from "@/lib/schedule";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";
import { emailFamilyTeacherCancel } from "@/lib/server/lesson-cancel-email";

const VALID_STATUSES = ["attended", "teacher_cancel", "student_cancel", "no_show"];
const NOTICE_CHOICES: StudentCancelNoticeChoice[] = [
  "now",
  "timely",
  "late",
  "custom",
];

/**
 * Mark or clear attendance for a lesson. Attendance rows record facts
 * (status + when notice was given); whether a cancellation is "late" or
 * earns a make-up credit is derived from studio_policies at read time (§3).
 *
 * Teacher cancellations optionally email the family (notifyFamily, default true).
 */
export async function PUT(
  req: NextRequest,
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

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, starts_at")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.status === null) {
    const { error } = await supabase.from("attendance").delete().eq("lesson_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let noticeAt: string | null = null;
  let cancelNote = "";

  if (typeof body.cancelNote === "string") {
    cancelNote = body.cancelNote.trim().slice(0, 1000);
  }

  if (body.status === "student_cancel") {
    const policy = await getPolicy(supabase, user.id);
    const choice = (body.noticeChoice ?? "now") as StudentCancelNoticeChoice;
    if (!NOTICE_CHOICES.includes(choice)) {
      return NextResponse.json({ error: "Invalid noticeChoice" }, { status: 400 });
    }
    noticeAt = resolveStudentCancelNoticeAt(
      choice,
      lesson.starts_at,
      policy.cancellation_window_hours,
      typeof body.noticeAt === "string" ? body.noticeAt : null
    );
  }

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        lesson_id: id,
        status: body.status,
        notice_at: noticeAt,
        cancel_note: cancelNote,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let emailed = false;
  let emailError: string | undefined;

  if (body.status === "teacher_cancel" && body.notifyFamily !== false) {
    const policy = await getPolicy(supabase, user.id);
    const result = await emailFamilyTeacherCancel({
      supabase,
      lessonId: id,
      teacherId: user.id,
      teacherEmail: user.email,
      policy,
      cancelNote,
      origin: requestOrigin(req),
    });
    emailed = result.emailed;
    emailError = result.emailError;
  }

  return NextResponse.json({ ...data, emailed, emailError });
}
