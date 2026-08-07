import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { formatEventWhen } from "@/lib/events";
import {
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
import { oneToOne, type StudioPolicy } from "@/lib/schedule";
import type { RsvpStatus } from "@/lib/supabase/types";

export type EventEmailMode = "invite" | "reminder";

type StudentRow = {
  repertoire: string;
  sort_order: number;
  students:
    | { id: string; name: string; guardian_id: string | null }
    | { id: string; name: string; guardian_id: string | null }[]
    | null;
};

type RsvpRow = {
  guardian_id: string;
  status: RsvpStatus;
  guardians:
    | (FamilyContact & { id: string; portal_token: string | null })
    | (FamilyContact & { id: string; portal_token: string | null })[]
    | null;
};

export type EventEmailRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  event_students: StudentRow[] | null;
  event_rsvps: RsvpRow[] | null;
};

const EVENT_EMAIL_SELECT = `
  id, title, description, location, starts_at, ends_at,
  event_students (
    repertoire, sort_order,
    students ( id, name, guardian_id )
  ),
  event_rsvps (
    guardian_id, status,
    guardians (
      id, name, email, secondary_name, secondary_email,
      email_recipients, portal_token
    )
  )
`;

export async function loadEventForEmail(
  supabase: SupabaseClient,
  eventId: string,
  teacherId?: string
): Promise<EventEmailRow | null> {
  let query = supabase
    .from("events")
    .select(EVENT_EMAIL_SELECT)
    .eq("id", eventId);

  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("event email load:", error);
    return null;
  }
  return data as EventEmailRow | null;
}

/**
 * Email invited families about an event (manual invite or day-before reminder).
 * Reminder mode skips RSVP = no.
 */
export async function sendEventEmails(args: {
  event: EventEmailRow;
  policy: StudioPolicy;
  teacherEmail?: string | null;
  origin: string;
  mode: EventEmailMode;
}): Promise<{ sent: number; skipped: number }> {
  const { event, policy, mode } = args;
  const when = formatEventWhen(event.starts_at, event.ends_at, policy.timezone);
  const signature = policy.studio_name
    ? `— ${policy.studio_name} (sent via CogNote Studio)`
    : "— Sent via CogNote Studio";
  const origin = args.origin.replace(/\/$/, "");

  const performersByGuardian = new Map<
    string,
    { name: string; repertoire: string }[]
  >();

  for (const row of event.event_students ?? []) {
    const student = oneToOne(row.students);
    if (!student?.guardian_id) continue;
    const list = performersByGuardian.get(student.guardian_id) ?? [];
    list.push({
      name: student.name,
      repertoire: row.repertoire?.trim() ?? "",
    });
    performersByGuardian.set(student.guardian_id, list);
  }

  let sent = 0;
  let skipped = 0;

  for (const rsvp of event.event_rsvps ?? []) {
    if (mode === "reminder" && rsvp.status === "no") {
      skipped += 1;
      continue;
    }

    const family = oneToOne(rsvp.guardians);
    if (!family) {
      skipped += 1;
      continue;
    }

    const recipients = familyEmailRecipients(family);
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const kids = performersByGuardian.get(rsvp.guardian_id) ?? [];
    const repertoireLines =
      kids.length === 0
        ? ""
        : `\n\nPerforming:\n${kids
            .map((k) =>
              k.repertoire
                ? `• ${k.name} — ${k.repertoire}`
                : `• ${k.name}`
            )
            .join("\n")}`;

    const locationLine = event.location?.trim()
      ? `\nLocation: ${event.location.trim()}`
      : "";
    const descriptionLine = event.description?.trim()
      ? `\n\n${event.description.trim()}`
      : "";

    const greeting = familyGreetingNames(family);
    const subject =
      mode === "reminder"
        ? `Reminder: ${event.title} is tomorrow`
        : `${event.title} — ${when}`;
    const intro =
      mode === "reminder"
        ? `This is a reminder that ${event.title} is tomorrow.`
        : `You're invited to ${event.title}.`;
    const cta =
      mode === "reminder"
        ? "Details and RSVP are in your family portal."
        : "Please RSVP in your family portal.";

    const portalToken = family.portal_token;
    const result = await sendEmail({
      to: recipients,
      subject,
      text: `Hi ${greeting},\n\n${intro}\n\nWhen: ${when}${locationLine}${descriptionLine}${repertoireLines}\n\n${cta}\n\n${signature}`,
      fromName: policy.studio_name
        ? `${policy.studio_name} (via CogNote)`
        : undefined,
      replyTo: args.teacherEmail ?? undefined,
      portalUrl: portalToken ? `${origin}/portal/${portalToken}` : undefined,
    });

    if (result.sent) {
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return { sent, skipped };
}
