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

type FamilyWithPortal = FamilyContact & {
  id: string;
  portal_token: string | null;
};

type CancelledLesson = {
  id: string;
  starts_at: string;
  student: {
    name: string;
    family: FamilyWithPortal;
  };
};

/**
 * Send one teacher-cancellation digest per family. This is intentionally used
 * only for a single bulk action, so a family never receives a burst of one
 * email per sibling or lesson.
 */
export async function emailFamiliesTeacherCancelBulk(args: {
  supabase: SupabaseClient;
  lessonIds: string[];
  teacherId: string;
  teacherEmail?: string | null;
  policy: StudioPolicy;
  origin: string;
}): Promise<{ emailed: number; emailErrors: number }> {
  if (args.lessonIds.length === 0) return { emailed: 0, emailErrors: 0 };

  const { data, error } = await args.supabase
    .from("lessons")
    .select(
      "id, starts_at, students ( name, guardians ( id, name, email, secondary_name, secondary_email, email_recipients, portal_token ) )"
    )
    .eq("teacher_id", args.teacherId)
    .in("id", args.lessonIds);

  if (error) {
    console.error("Failed to load bulk-cancel email recipients:", error);
    return { emailed: 0, emailErrors: args.lessonIds.length };
  }

  const byFamily = new Map<string, { family: FamilyWithPortal; lessons: CancelledLesson[] }>();

  for (const row of data ?? []) {
    const student = oneToOne(
      row.students as unknown as
        | { name: string; guardians: FamilyWithPortal | FamilyWithPortal[] | null }
        | { name: string; guardians: FamilyWithPortal | FamilyWithPortal[] | null }[]
        | null
    );
    const family = student ? oneToOne(student.guardians) : null;
    if (!student || !family) continue;

    const entry = byFamily.get(family.id) ?? { family, lessons: [] };
    entry.lessons.push({
      id: row.id,
      starts_at: row.starts_at,
      student: { name: student.name, family },
    });
    byFamily.set(family.id, entry);
  }

  const studio = args.policy.studio_name || "your teacher";
  const signature = args.policy.studio_name
    ? `— ${args.policy.studio_name} (sent via CogNote Studio)`
    : "— Sent via CogNote Studio";
  let emailed = 0;
  let emailErrors = 0;

  for (const { family, lessons } of byFamily.values()) {
    const recipients = familyEmailRecipients(family);
    if (recipients.length === 0) {
      emailErrors += 1;
      continue;
    }

    const sortedLessons = [...lessons].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
    const lessonLines = sortedLessons
      .map(
        (lesson) =>
          `• ${lesson.student.name} — ${formatLessonDate(
            lesson.starts_at,
            args.policy.timezone,
            "long"
          )} at ${formatLessonTime(lesson.starts_at, args.policy.timezone)}`
      )
      .join("\n");
    const plural = sortedLessons.length === 1 ? "lesson" : "lessons";
    const portalUrl = family.portal_token
      ? `${args.origin.replace(/\/$/, "")}/portal/${family.portal_token}`
      : undefined;

    const result = await sendEmail({
      to: recipients,
      subject: `${sortedLessons.length} ${plural} cancelled`,
      text: `Hi ${familyGreetingNames(family)},\n\n${studio} has cancelled the following ${plural}:\n\n${lessonLines}\n\nPlease check your family portal for the updated schedule.\n\n${signature}`,
      fromName: args.policy.studio_name
        ? `${args.policy.studio_name} (via CogNote)`
        : undefined,
      replyTo: args.teacherEmail ?? undefined,
      portalUrl,
    });

    if (result.sent) emailed += 1;
    else emailErrors += 1;
  }

  return { emailed, emailErrors };
}
