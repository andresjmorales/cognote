import { NextRequest, NextResponse } from "next/server";
import type { EventAttributes } from "ics";
import { createServiceClient } from "@/lib/supabase/server";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import { addDays, toLocalDateString, oneToOne } from "@/lib/schedule";
import { formatEventDateKey } from "@/lib/events";
import {
  lessonEvent,
  studioEvent,
  icsResponse,
  icsFilename,
} from "@/lib/calendar-feed";
import {
  rejectIfTokenLookupsBlocked,
  recordTokenLookupFailure,
} from "@/lib/server/token-guard";

/**
 * Read-only teacher schedule feed (webcal-subscribable): every lesson plus
 * studio events (recitals), cancelled lessons dropped. Token-based like the
 * family portal feed — service-role client + token lookup in application
 * code — behind the shared brute-force guard. UIDs are stable per lesson/
 * event so subscriptions stay current.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const blocked = rejectIfTokenLookupsBlocked(req);
  if (blocked) return blocked;

  const supabase = createServiceClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, display_name")
    .eq("calendar_token", token)
    .single();

  if (!teacher) {
    recordTokenLookupFailure(req);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const policy = await getPolicy(supabase, teacher.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  const from = addDays(today, -7);
  const to = addDays(today, 84);
  await materializeLessons(supabase, teacher.id, from, to);

  const [lessonsRes, eventsRes] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, starts_at, duration_minutes, students ( name ), attendance!lesson_id ( status )"
      )
      .eq("teacher_id", teacher.id)
      .gte("lesson_date", from)
      .lte("lesson_date", to)
      .order("starts_at"),
    supabase
      .from("events")
      .select("id, title, location, starts_at, ends_at")
      .eq("teacher_id", teacher.id)
      .gte("starts_at", `${addDays(from, -1)}T00:00:00.000Z`)
      .lte("starts_at", `${addDays(to, 2)}T00:00:00.000Z`)
      .order("starts_at"),
  ]);

  const calName = policy.studio_name || "Piano Lessons";

  const lessonEvents: EventAttributes[] = (lessonsRes.data ?? [])
    .filter((l) => {
      const status = oneToOne(
        l.attendance as { status: string }[] | { status: string } | null
      )?.status;
      return status !== "teacher_cancel" && status !== "student_cancel";
    })
    .map((l) =>
      lessonEvent(
        {
          id: l.id,
          starts_at: l.starts_at,
          duration_minutes: l.duration_minutes,
          studentName:
            oneToOne(l.students as { name: string }[] | null)?.name ?? "Student",
        },
        calName
      )
    );

  // The events window is padded by a day either side because starts_at is a
  // timestamp while `from`/`to` are studio-local dates; filter on the local
  // day, exactly as the Schedule week view does.
  const studioEvents: EventAttributes[] = (eventsRes.data ?? [])
    .filter((e) => {
      const day = formatEventDateKey(e.starts_at, policy.timezone);
      return day >= from && day <= to;
    })
    .map((e) => studioEvent(e, calName));

  return icsResponse(
    [...lessonEvents, ...studioEvents],
    icsFilename(teacher.display_name, "schedule")
  );
}
