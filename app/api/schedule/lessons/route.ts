import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { zonedTimeToUtc, oneToOne } from "@/lib/schedule";

/**
 * Create an ad-hoc lesson (slot_id NULL) — used for one-off lessons and
 * make-ups. When makeupFor is set, it must reference an attendance row of a
 * cancellation for the same student; the UNIQUE constraint on
 * lessons.makeup_for guarantees a credit can only be redeemed once (§3).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (
    !body.studentId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ||
    !/^\d{2}:\d{2}$/.test(body.time ?? "")
  ) {
    return NextResponse.json(
      { error: "studentId, date (YYYY-MM-DD) and time (HH:mm) are required" },
      { status: 400 }
    );
  }

  let durationMinutes = Number(body.durationMinutes) || 30;

  if (body.makeupFor) {
    // lessons!lesson_id disambiguates from the lessons.makeup_for relationship
    const { data: credit } = await supabase
      .from("attendance")
      .select("id, status, lessons!lesson_id ( student_id, duration_minutes, teacher_id )")
      .eq("id", body.makeupFor)
      .single();

    const lesson = oneToOne(
      credit?.lessons as unknown as
        | {
            student_id: string;
            duration_minutes: number;
            teacher_id: string;
          }[]
        | null
    );

    if (!credit || lesson?.teacher_id !== user.id) {
      return NextResponse.json({ error: "Credit not found" }, { status: 404 });
    }
    if (credit.status === "attended") {
      return NextResponse.json(
        { error: "That lesson was attended — no make-up credit" },
        { status: 400 }
      );
    }
    if (lesson.student_id !== body.studentId) {
      return NextResponse.json(
        { error: "Make-up must be for the same student" },
        { status: 400 }
      );
    }
    if (!Number(body.durationMinutes)) durationMinutes = lesson.duration_minutes;
  }

  const policy = await getPolicy(supabase, user.id);
  const startsAt = zonedTimeToUtc(body.date, body.time, policy.timezone);

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      teacher_id: user.id,
      student_id: body.studentId,
      slot_id: null,
      lesson_date: body.date,
      starts_at: startsAt.toISOString(),
      duration_minutes: durationMinutes,
      makeup_for: body.makeupFor || null,
    })
    .select()
    .single();

  if (error) {
    // Unique violation on makeup_for = credit already redeemed
    const status = error.code === "23505" ? 409 : 500;
    const message =
      error.code === "23505"
        ? "This make-up credit has already been used"
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(data);
}
