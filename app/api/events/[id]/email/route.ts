import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { formatEventWhen } from "@/lib/events";
import {
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";

export async function POST(
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

  const { data: event, error } = await supabase
    .from("events")
    .select(
      `
      id, title, description, location, starts_at, ends_at,
      event_students (
        repertoire, sort_order,
        students ( id, name, guardian_id )
      ),
      event_rsvps (
        guardian_id,
        guardians (
          id, name, email, secondary_name, secondary_email,
          email_recipients, portal_token
        )
      )
    `
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("event email load:", error);
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const policy = await getPolicy(supabase, user.id);
  const when = formatEventWhen(event.starts_at, event.ends_at, policy.timezone);
  const signature = policy.studio_name
    ? `— ${policy.studio_name} (sent via CogNote Studio)`
    : "— Sent via CogNote Studio";
  const origin = requestOrigin(req);

  type StudentRow = {
    repertoire: string;
    sort_order: number;
    students:
      | { id: string; name: string; guardian_id: string | null }
      | { id: string; name: string; guardian_id: string | null }[]
      | null;
  };

  const performersByGuardian = new Map<
    string,
    { name: string; repertoire: string }[]
  >();

  for (const row of (event.event_students as StudentRow[] | null) ?? []) {
    const student = oneToOne(row.students);
    if (!student?.guardian_id) continue;
    const list = performersByGuardian.get(student.guardian_id) ?? [];
    list.push({
      name: student.name,
      repertoire: row.repertoire?.trim() ?? "",
    });
    performersByGuardian.set(student.guardian_id, list);
  }

  type RsvpRow = {
    guardian_id: string;
    guardians:
      | (FamilyContact & { id: string; portal_token: string | null })
      | (FamilyContact & { id: string; portal_token: string | null })[]
      | null;
  };

  let sent = 0;
  let skipped = 0;

  for (const rsvp of (event.event_rsvps as RsvpRow[] | null) ?? []) {
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

    const portalToken = family.portal_token;
    const result = await sendEmail({
      to: recipients,
      subject: `${event.title} — ${when}`,
      text: `Hi ${familyGreetingNames(family)},\n\nYou're invited to ${event.title}.\n\nWhen: ${when}${locationLine}${descriptionLine}${repertoireLines}\n\nPlease RSVP in your family portal.\n\n${signature}`,
      fromName: policy.studio_name
        ? `${policy.studio_name} (via CogNote)`
        : undefined,
      replyTo: user.email,
      portalUrl: portalToken ? `${origin}/portal/${portalToken}` : undefined,
    });

    if (result.sent) {
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json({ sent, skipped });
}
