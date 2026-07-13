import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { createTeacherNotification } from "@/lib/server/notifications";
import { familyDisplayName } from "@/lib/guardians";
import { requestOrigin } from "@/lib/server/http";
import type { RsvpStatus } from "@/lib/supabase/types";

const RESPONDABLE: ReadonlySet<string> = new Set(["yes", "no", "maybe"]);

/**
 * Family portal: RSVP to an invited studio event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id: eventId } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, name, family_name, teacher_id")
    .eq("portal_token", token)
    .single();

  if (!guardian) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, teacher_id")
    .eq("id", eventId)
    .eq("teacher_id", guardian.teacher_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: existingRsvp } = await supabase
    .from("event_rsvps")
    .select("id")
    .eq("event_id", eventId)
    .eq("guardian_id", guardian.id)
    .maybeSingle();

  if (!existingRsvp) {
    return NextResponse.json(
      { error: "Your family is not invited to this event" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "";
  if (!RESPONDABLE.has(status)) {
    return NextResponse.json(
      { error: "status must be yes, no, or maybe" },
      { status: 400 }
    );
  }

  let partySize: number | null = null;
  if (body.partySize !== undefined && body.partySize !== null && body.partySize !== "") {
    const n = Number(body.partySize);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return NextResponse.json(
        { error: "partySize must be a whole number between 1 and 99" },
        { status: 400 }
      );
    }
    partySize = n;
  }

  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const respondedAt = new Date().toISOString();

  const { error } = await supabase
    .from("event_rsvps")
    .update({
      status: status as Exclude<RsvpStatus, "pending">,
      party_size: partySize,
      note,
      responded_at: respondedAt,
    })
    .eq("id", existingRsvp.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const policy = await getPolicy(supabase, guardian.teacher_id);
  const family = familyDisplayName(guardian);
  const statusLabel =
    status === "yes" ? "Yes" : status === "no" ? "No" : "Maybe";

  await createTeacherNotification(supabase, {
    teacherId: guardian.teacher_id,
    type: "event_rsvp",
    title: `${family} RSVP’d ${statusLabel} to ${event.title}`,
    body: [
      partySize != null ? `Party size: ${partySize}` : null,
      note ? `Note: ${note}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    href: `/events/${eventId}`,
    origin: requestOrigin(req),
    policy,
  });

  return NextResponse.json({ ok: true });
}
