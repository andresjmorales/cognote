import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import {
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";
import { formatLessonTime, formatLessonDate, ATTENDANCE_LABELS, oneToOne } from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";

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
      "id, lesson_date, starts_at, students ( name, guardians ( name, email, secondary_name, secondary_email, email_recipients, portal_token ) ), attendance!lesson_id ( status )"
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
      guardians: (FamilyContact & { portal_token: string | null }) | null;
    } | null;
    const family = student?.guardians;
    const recipients = family ? familyEmailRecipients(family) : [];

    if (!student || !family || recipients.length === 0) {
      emailError = "No family email on file for this student";
    } else {
      const policy = await getPolicy(supabase, user.id);
      const when = `${formatLessonDate(lesson.starts_at, policy.timezone, "long")} at ${formatLessonTime(lesson.starts_at, policy.timezone)}`;
      const signature = policy.studio_name
        ? `— ${policy.studio_name} (sent via CogNote Studio)`
        : "— Sent via CogNote Studio";

      const portalToken = family.portal_token;
      const attendance = oneToOne(
        lesson.attendance as { status: AttendanceStatus }[] | { status: AttendanceStatus } | null
      );
      const statusLine = attendance
        ? `Status: ${ATTENDANCE_LABELS[attendance.status]}\n\n`
        : "";
      const result = await sendEmail({
        to: recipients,
        subject: `Lesson notes for ${student.name} — ${when}`,
        text: `Hi ${familyGreetingNames(family)},\n\nNotes from ${student.name}'s lesson on ${when}:\n\n${statusLine}${body.body.trim()}\n\n${signature}`,
        fromName: policy.studio_name
          ? `${policy.studio_name} (via CogNote)`
          : undefined,
        // Parent replies go to the teacher, never to the platform.
        replyTo: user.email,
        portalUrl: portalToken
          ? `${requestOrigin(req)}/portal/${portalToken}`
          : undefined,
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
