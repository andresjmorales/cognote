import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { materializeLessons } from "@/lib/server/scheduling";
import { addDays, toLocalDateString } from "@/lib/schedule";
import { getPolicy } from "@/lib/server/scheduling";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const dayOfWeek = Number(body.dayOfWeek);
  if (
    !body.studentId ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !/^\d{2}:\d{2}$/.test(body.startTime ?? "")
  ) {
    return NextResponse.json(
      { error: "studentId, dayOfWeek (0-6) and startTime (HH:mm) are required" },
      { status: 400 }
    );
  }

  const { data: slot, error } = await supabase
    .from("lesson_slots")
    .insert({
      teacher_id: user.id,
      student_id: body.studentId,
      day_of_week: dayOfWeek,
      start_time: body.startTime,
      duration_minutes: Number(body.durationMinutes) || 30,
      start_date: body.startDate || undefined,
      end_date: body.endDate || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Materialize the standard horizon right away so the new slot shows up
  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  await materializeLessons(supabase, user.id, today, addDays(today, 56));

  return NextResponse.json(slot);
}
