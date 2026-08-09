import { NextRequest, NextResponse } from "next/server";
import { isEventReminderDay } from "@/lib/events";
import { createServiceClient } from "@/lib/supabase/server";
import {
  sendEventEmails,
  type EventEmailRow,
} from "@/lib/server/event-email";
import { requestOrigin } from "@/lib/server/http";
import { DEFAULT_POLICY, type StudioPolicy } from "@/lib/schedule";
import { secureCompare } from "@/lib/server/secure-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  return secureCompare(header, `Bearer ${secret}`);
}

function cronOrigin(req: NextRequest): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  return requestOrigin(req);
}

/**
 * Daily job (Hobby allows once/day): email families the studio-local day
 * before events with send_reminder enabled. Secure with CRON_SECRET
 * (Vercel Cron sends it). Schedule: 14:00 UTC ≈ morning US Central.
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const origin = cronOrigin(req);

  const { data: events, error } = await supabase
    .from("events")
    .select(
      `
      id, teacher_id, title, description, location, starts_at, ends_at,
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
    `
    )
    .eq("send_reminder", true)
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString());

  if (error) {
    console.error("event-reminders load:", error);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 }
    );
  }

  const candidates = events ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  const teacherIds = Array.from(
    new Set(candidates.map((e) => e.teacher_id as string))
  );

  const [{ data: policies }, { data: teachers }] = await Promise.all([
    supabase
      .from("studio_policies")
      .select("*")
      .in("teacher_id", teacherIds),
    supabase.from("teachers").select("id, email").in("id", teacherIds),
  ]);

  const policyByTeacher = new Map<string, StudioPolicy>();
  for (const row of policies ?? []) {
    policyByTeacher.set(row.teacher_id, {
      ...DEFAULT_POLICY,
      ...row,
    } as StudioPolicy);
  }
  const emailByTeacher = new Map(
    (teachers ?? []).map((t) => [t.id as string, t.email as string])
  );

  let processed = 0;
  let sentTotal = 0;
  let skippedTotal = 0;

  for (const event of candidates) {
    const teacherId = event.teacher_id as string;
    const policy =
      policyByTeacher.get(teacherId) ?? ({ ...DEFAULT_POLICY } as StudioPolicy);

    if (!isEventReminderDay(event.starts_at, policy.timezone, now)) {
      continue;
    }

    const emailEvent: EventEmailRow = {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      event_students: (event.event_students ?? null) as EventEmailRow["event_students"],
      event_rsvps: (event.event_rsvps ?? null) as EventEmailRow["event_rsvps"],
    };

    const { sent, skipped } = await sendEventEmails({
      event: emailEvent,
      policy,
      teacherEmail: emailByTeacher.get(teacherId) ?? null,
      origin,
      mode: "reminder",
    });

    const { error: markError } = await supabase
      .from("events")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", event.id);

    if (markError) {
      console.error("event-reminders mark sent:", event.id, markError);
    }

    processed += 1;
    sentTotal += sent;
    skippedTotal += skipped;
  }

  return NextResponse.json({
    processed,
    sent: sentTotal,
    skipped: skippedTotal,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
