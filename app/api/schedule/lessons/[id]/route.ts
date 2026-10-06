import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oneToOne, toLocalDateString } from "@/lib/schedule";
import { getPolicy } from "@/lib/server/scheduling";
import { planLessonMove, findMoveConflicts } from "@/lib/reschedule";

/**
 * Update a single lesson occurrence (e.g. home-visit flag for travel fees).
 * Works for both slot-materialized and ad-hoc lessons.
 */
export async function PUT(
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

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  const warnings: string[] = [];

  if (body.isHomeVisit !== undefined) {
    update.is_home_visit = Boolean(body.isHomeVisit);
  }

  const hasMove =
    body.date !== undefined ||
    body.time !== undefined ||
    body.durationMinutes !== undefined;

  if (hasMove) {
    const { data: lesson, error: loadError } = await supabase
      .from("lessons")
      .select(
        "id, student_id, slot_id, lesson_date, starts_at, duration_minutes, rescheduled_from_date, attendance!lesson_id ( id )"
      )
      .eq("id", id)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!lesson) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // A marked lesson is history; moving it would rewrite what happened.
    if (oneToOne(lesson.attendance as { id: string }[] | null)) {
      return NextResponse.json(
        { error: "Marked lessons can't be moved — clear attendance first" },
        { status: 400 }
      );
    }

    const policy = await getPolicy(supabase, user.id);
    const plan = planLessonMove(body, lesson, policy.timezone);
    if (!plan.ok) {
      return NextResponse.json({ error: plan.error }, { status: 400 });
    }
    Object.assign(update, plan.patch);

    // Warn (never block) when the new time clashes with another lesson.
    if (plan.patch.starts_at || plan.patch.duration_minutes) {
      const startsAt = (plan.patch.starts_at as string) ?? lesson.starts_at;
      const duration =
        (plan.patch.duration_minutes as number) ?? lesson.duration_minutes;
      const localDate = toLocalDateString(new Date(startsAt), policy.timezone);
      const { data: others } = await supabase
        .from("lessons")
        .select("id, student_id, starts_at, duration_minutes")
        .eq("teacher_id", user.id)
        .eq("lesson_date", localDate)
        .neq("id", id);
      const conflict = findMoveConflicts(
        { studentId: lesson.student_id, startsAt, durationMinutes: duration },
        (others ?? []).map((o) => ({
          studentId: o.student_id,
          startsAt: o.starts_at,
          durationMinutes: o.duration_minutes,
        }))
      );
      if (conflict.studentOverlap) {
        warnings.push("This student already has a lesson at that time");
      } else if (conflict.teacherOverlap) {
        warnings.push("Another lesson already occupies part of that time");
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lessons")
    .update(update)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select(
      "id, is_home_visit, lesson_date, starts_at, duration_minutes, rescheduled_from_date"
    )
    .single();

  if (error) {
    // Unique (slot_id, lesson_date): the target slot already has a lesson.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That slot already has a lesson on that date" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(warnings.length ? { ...data, warnings } : data);
}

/**
 * Delete an ad-hoc lesson (one-off or make-up). Slot-materialized lessons
 * can't be deleted — they'd just be re-materialized; cancel them via
 * attendance instead.
 */
export async function DELETE(
  _req: NextRequest,
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

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, slot_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lesson.slot_id) {
    return NextResponse.json(
      { error: "Recurring lessons can't be deleted — mark them cancelled instead" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
