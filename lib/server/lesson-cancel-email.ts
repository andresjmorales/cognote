import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import {
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
import {
  formatLessonDate,
  formatLessonTime,
  oneToOne,
  type StudioPolicy,
} from "@/lib/schedule";

/**
 * Email the family that the teacher cancelled a lesson.
 * Returns emailed + optional error (e.g. no address on file).
 */
export async function emailFamilyTeacherCancel(args: {
  supabase: SupabaseClient;
  lessonId: string;
  teacherId: string;
  teacherEmail?: string | null;
  policy: StudioPolicy;
  cancelNote?: string;
  origin: string;
}): Promise<{ emailed: boolean; emailError?: string }> {
  const { data: lesson } = await args.supabase
    .from("lessons")
    .select(
      "id, starts_at, students ( name, guardians ( name, email, secondary_name, secondary_email, email_recipients, portal_token ) )"
    )
    .eq("id", args.lessonId)
    .eq("teacher_id", args.teacherId)
    .single();

  if (!lesson) {
    return { emailed: false, emailError: "Lesson not found" };
  }

  const student = oneToOne(
    lesson.students as unknown as
      | {
          name: string;
          guardians: (FamilyContact & { portal_token: string | null }) | null;
        }
      | {
          name: string;
          guardians: (FamilyContact & { portal_token: string | null }) | null;
        }[]
      | null
  );
  const family = student?.guardians ?? null;
  const recipients = family ? familyEmailRecipients(family) : [];

  if (!student || !family || recipients.length === 0) {
    return { emailed: false, emailError: "No family email on file" };
  }

  const when = `${formatLessonDate(lesson.starts_at, args.policy.timezone, "long")} at ${formatLessonTime(lesson.starts_at, args.policy.timezone)}`;
  const studio = args.policy.studio_name || "your teacher";
  const note = args.cancelNote?.trim();
  const noteLine = note ? `\n\nNote: ${note}` : "";
  const signature = args.policy.studio_name
    ? `— ${args.policy.studio_name} (sent via CogNote Studio)`
    : "— Sent via CogNote Studio";
  const portalToken = family.portal_token;

  const result = await sendEmail({
    to: recipients,
    subject: `Lesson cancelled — ${student.name} · ${when}`,
    text: `Hi ${familyGreetingNames(family)},\n\n${studio} has cancelled ${student.name}'s lesson on ${when}.${noteLine}\n\nPlease check your family portal for the updated schedule.\n\n${signature}`,
    fromName: args.policy.studio_name
      ? `${args.policy.studio_name} (via CogNote)`
      : undefined,
    replyTo: args.teacherEmail ?? undefined,
    portalUrl: portalToken
      ? `${args.origin.replace(/\/$/, "")}/portal/${portalToken}`
      : undefined,
  });

  return { emailed: result.sent, emailError: result.error };
}
