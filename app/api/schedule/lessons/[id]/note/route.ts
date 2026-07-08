import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getPolicy } from "@/lib/server/scheduling";
import { formatLessonTime, formatLessonDate } from "@/lib/schedule";

/**
 * Save the per-lesson note. Emailing the family is an explicit action
 * (sendEmail: true), never a side effect of saving — no surprise emails
 * on every edit.
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
    .select(
      "id, lesson_date, starts_at, students ( name, guardians ( name, email ) )"
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const shared = Boolean(body.sharedWithParent);
  const { data: note, error } = await supabase
    .from("lesson_notes")
    .upsert(
      { lesson_id: id, body: body.body.trim(), shared_with_parent: shared },
      { onConflict: "lesson_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let emailed = false;
  let emailError: string | undefined;

  if (body.sendEmail && shared) {
    const student = lesson.students as unknown as {
      name: string;
      guardians: { name: string; email: string | null } | null;
    } | null;
    const guardianEmail = student?.guardians?.email;

    if (!guardianEmail) {
      emailError = "No family email on file for this student";
    } else {
      const policy = await getPolicy(supabase, user.id);
      const when = `${formatLessonDate(lesson.starts_at, policy.timezone, "long")} at ${formatLessonTime(lesson.starts_at, policy.timezone)}`;
      const signature = policy.studio_name
        ? `— ${policy.studio_name} (sent via CogNote Studio)`
        : "— Sent via CogNote Studio";

      const result = await sendEmail({
        to: guardianEmail,
        subject: `Lesson notes for ${student.name} — ${when}`,
        text: `Hi ${student.guardians!.name},\n\nNotes from ${student.name}'s lesson on ${when}:\n\n${body.body.trim()}\n\n${signature}`,
        fromName: policy.studio_name
          ? `${policy.studio_name} (via CogNote)`
          : undefined,
        // Parent replies go to the teacher, never to the platform.
        replyTo: user.email,
      });
      emailed = result.sent;
      emailError = result.error;
      if (emailed) {
        await supabase
          .from("lesson_notes")
          .update({ emailed_at: new Date().toISOString() })
          .eq("lesson_id", id);
      }
    }
  }

  return NextResponse.json({ ...note, emailed, emailError });
}
