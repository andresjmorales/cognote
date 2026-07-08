import { NextRequest, NextResponse } from "next/server";
import { createEvents, type EventAttributes } from "ics";
import { createServiceClient } from "@/lib/supabase/server";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import { addDays, toLocalDateString, oneToOne } from "@/lib/schedule";

/**
 * Per-family .ics feed (webcal-subscribable). Token-based like the rest of
 * the portal: service-role client + token lookup in application code.
 * UIDs are stable per lesson so calendar clients update instead of
 * duplicating events on refresh.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, name, teacher_id, students ( id, name )")
    .eq("portal_token", token)
    .single();

  if (!guardian) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const students = (guardian.students ?? []) as { id: string; name: string }[];
  if (students.length === 0) {
    return icsResponse([], guardian.name);
  }

  const policy = await getPolicy(supabase, guardian.teacher_id);
  const today = toLocalDateString(new Date(), policy.timezone);
  await materializeLessons(supabase, guardian.teacher_id, today, addDays(today, 84));

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, student_id, starts_at, duration_minutes, attendance!lesson_id ( status )")
    .in("student_id", students.map((s) => s.id))
    .gte("lesson_date", addDays(today, -7))
    .lte("lesson_date", addDays(today, 84))
    .order("starts_at");

  const nameById = new Map(students.map((s) => [s.id, s.name]));

  const events: EventAttributes[] = (lessons ?? [])
    .filter((l) => {
      const status = oneToOne(
        l.attendance as { status: string }[] | { status: string } | null
      )?.status;
      return status !== "teacher_cancel" && status !== "student_cancel";
    })
    .map((l) => {
      const start = new Date(l.starts_at);
      return {
        uid: `${l.id}@cognote.studio`,
        start: [
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          start.getUTCDate(),
          start.getUTCHours(),
          start.getUTCMinutes(),
        ],
        startInputType: "utc",
        startOutputType: "utc",
        duration: { minutes: l.duration_minutes },
        title: `Piano lesson — ${nameById.get(l.student_id) ?? "Student"}`,
        calName: "Piano Lessons",
      };
    });

  return icsResponse(events, guardian.name);
}

function icsResponse(events: EventAttributes[], familyName: string) {
  let body =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CogNote Studio//EN\r\nEND:VCALENDAR\r\n";
  if (events.length > 0) {
    const { value, error } = createEvents(events);
    if (error || !value) {
      return NextResponse.json({ error: "Calendar generation failed" }, { status: 500 });
    }
    body = value;
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="lessons-${familyName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
