import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import { addDays, toLocalDateString, oneToOne } from "@/lib/schedule";
import { familyDisplayName } from "@/lib/guardians";
import {
  lessonEvent,
  icsResponse,
  icsFilename,
} from "@/lib/calendar-feed";
import {
  rejectIfTokenLookupsBlocked,
  recordTokenLookupFailure,
} from "@/lib/server/token-guard";

/**
 * Per-family .ics feed (webcal-subscribable). Token-based like the rest of
 * the portal: service-role client + token lookup in application code.
 * UIDs are stable per lesson so calendar clients update instead of
 * duplicating events on refresh.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const blocked = rejectIfTokenLookupsBlocked(req);
  if (blocked) return blocked;

  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, name, family_name, teacher_id, students ( id, name )")
    .eq("portal_token", token)
    .single();

  if (!guardian) {
    recordTokenLookupFailure(req);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const students = (guardian.students ?? []) as { id: string; name: string }[];
  if (students.length === 0) {
    return icsResponse([], icsFilename(familyDisplayName(guardian)));
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

  const events = (lessons ?? [])
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
          studentName: nameById.get(l.student_id) ?? "Student",
        },
        "Piano Lessons"
      )
    );

  return icsResponse(events, icsFilename(familyDisplayName(guardian)));
}
