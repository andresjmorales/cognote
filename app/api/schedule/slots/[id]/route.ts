import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import {
  addDays,
  computeOccurrences,
  isDateString,
  oneToOne,
  toLocalDateString,
  type SlotRow,
} from "@/lib/schedule";

interface UpcomingLesson {
  id: string;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
  is_home_visit: boolean;
  // One-to-one embeds (UNIQUE lesson_id): PostgREST may return an object
  // or an array depending on relationship detection — go through oneToOne.
  attendance: { id: string } | { id: string }[] | null;
  lesson_notes: { id: string } | { id: string }[] | null;
}

/**
 * Upcoming lessons of a slot (starting from now on). Lessons earlier today
 * have already happened and are left alone even if not marked yet.
 */
async function upcomingSlotLessons(
  supabase: SupabaseClient,
  slotId: string
): Promise<UpcomingLesson[] | null> {
  // attendance!lesson_id disambiguates from the lessons.makeup_for FK —
  // the bare embed is ambiguous and PostgREST rejects the whole query,
  // which used to leave deleted slots' lessons stranded on the calendar.
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id, lesson_date, starts_at, duration_minutes, is_home_visit, attendance!lesson_id ( id ), lesson_notes ( id )"
    )
    .eq("slot_id", slotId)
    .gte("starts_at", new Date().toISOString());

  if (error) {
    console.error("upcomingSlotLessons select failed:", error.message);
    return null;
  }
  return (data ?? []) as UpcomingLesson[];
}

const isMarked = (l: UpcomingLesson) => oneToOne(l.attendance) !== null;
const hasNote = (l: UpcomingLesson) => oneToOne(l.lesson_notes) !== null;

/**
 * Bring a slot's upcoming unmarked lessons in line with the slot after an
 * edit. Marked lessons (attendance exists) are history and never touched.
 * Unmarked lessons whose date is still on the schedule are re-timed in
 * place, so notes and per-lesson tweaks survive; ones that fall off the
 * schedule are removed — or, if they carry a note, kept as one-offs so the
 * teacher's writing is never silently deleted. Missing dates are then
 * filled by materializeLessons.
 */
async function syncUpcomingLessons(
  supabase: SupabaseClient,
  slot: SlotRow,
  timeZone: string,
  today: string,
  homeVisitChanged: boolean
): Promise<string | null> {
  const lessons = await upcomingSlotLessons(supabase, slot.id);
  if (!lessons) return "Couldn't load upcoming lessons for this slot";

  const unmarked = lessons.filter((l) => !isMarked(l));
  if (unmarked.length === 0) return null;

  const lastDate = unmarked.reduce(
    (max, l) => (l.lesson_date > max ? l.lesson_date : max),
    addDays(today, 56)
  );
  const nextByDate = new Map(
    computeOccurrences(slot, today, lastDate, timeZone).map((o) => [
      o.lesson_date,
      o,
    ])
  );

  const toDelete: string[] = [];
  const toDetach: string[] = [];
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];

  for (const lesson of unmarked) {
    const next = nextByDate.get(lesson.lesson_date);
    if (!next) {
      (hasNote(lesson) ? toDetach : toDelete).push(lesson.id);
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (new Date(lesson.starts_at).getTime() !== new Date(next.starts_at).getTime()) {
      patch.starts_at = next.starts_at;
    }
    if (lesson.duration_minutes !== next.duration_minutes) {
      patch.duration_minutes = next.duration_minutes;
    }
    // Per-lesson home-visit overrides only yield to an explicit slot change
    if (homeVisitChanged && lesson.is_home_visit !== next.is_home_visit) {
      patch.is_home_visit = next.is_home_visit;
    }
    if (Object.keys(patch).length > 0) {
      updates.push(supabase.from("lessons").update(patch).eq("id", lesson.id));
    }
  }

  const results = await Promise.all([
    ...updates,
    toDelete.length > 0
      ? supabase.from("lessons").delete().in("id", toDelete)
      : Promise.resolve({ error: null }),
    toDetach.length > 0
      ? supabase.from("lessons").update({ slot_id: null }).in("id", toDetach)
      : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("syncUpcomingLessons write failed:", failed.error.message);
    return "Saved the slot, but some upcoming lessons couldn't be updated";
  }
  return null;
}

/** Postgres returns time as "HH:mm:ss"; the form sends "HH:mm". */
function normalize(value: unknown): unknown {
  return typeof value === "string" && /^\d{2}:\d{2}:00$/.test(value)
    ? value.slice(0, 5)
    : value;
}

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
  if (body.dayOfWeek !== undefined) {
    const day = Number(body.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return NextResponse.json({ error: "dayOfWeek must be 0-6" }, { status: 400 });
    }
    update.day_of_week = day;
  }
  if (body.startTime !== undefined) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(body.startTime ?? "")) {
      return NextResponse.json({ error: "startTime must be HH:mm" }, { status: 400 });
    }
    update.start_time = body.startTime;
  }
  if (body.durationMinutes !== undefined) {
    const minutes = Number(body.durationMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    update.duration_minutes = minutes;
  }
  if (body.startDate !== undefined) {
    if (!isDateString(body.startDate)) {
      return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 400 });
    }
    update.start_date = body.startDate;
  }
  if (body.endDate !== undefined) {
    if (body.endDate && !isDateString(body.endDate)) {
      return NextResponse.json({ error: "endDate must be YYYY-MM-DD" }, { status: 400 });
    }
    update.end_date = body.endDate || null;
  }
  if (body.active !== undefined) update.active = Boolean(body.active);
  if (body.rateCents !== undefined) {
    update.rate_cents =
      body.rateCents === null || body.rateCents === ""
        ? null
        : Math.max(0, Math.round(Number(body.rateCents)));
  }
  if (body.isHomeVisit !== undefined) {
    update.is_home_visit = Boolean(body.isHomeVisit);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("lesson_slots")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const startDate = (update.start_date ?? before.start_date) as string;
  const endDate = (update.end_date !== undefined ? update.end_date : before.end_date) as
    | string
    | null;
  if (endDate && endDate < startDate) {
    return NextResponse.json(
      { error: "End date can't be before the start date" },
      { status: 400 }
    );
  }

  const { data: slot, error } = await supabase
    .from("lesson_slots")
    .update(update)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A rate change doesn't touch lessons (rates resolve at billing time).
  const affectsLessons = [
    "day_of_week",
    "start_time",
    "duration_minutes",
    "start_date",
    "end_date",
    "active",
    "is_home_visit",
  ].some((key) => key in update && normalize(update[key]) !== normalize(before[key]));

  let warning: string | null = null;
  if (affectsLessons) {
    const policy = await getPolicy(supabase, user.id);
    const today = toLocalDateString(new Date(), policy.timezone);
    warning = await syncUpcomingLessons(
      supabase,
      slot as SlotRow,
      policy.timezone,
      today,
      "is_home_visit" in update && update.is_home_visit !== before.is_home_visit
    );
    await materializeLessons(supabase, user.id, today, addDays(today, 56));
  }

  return NextResponse.json(warning ? { ...slot, warning } : slot);
}

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

  // Upcoming unmarked lessons go with the slot. Past and marked lessons keep
  // their history; their slot_id becomes NULL via the FK.
  const lessons = await upcomingSlotLessons(supabase, id);
  if (!lessons) {
    return NextResponse.json(
      { error: "Couldn't load this slot's upcoming lessons" },
      { status: 500 }
    );
  }
  const unmarked = lessons.filter((l) => !isMarked(l)).map((l) => l.id);
  if (unmarked.length > 0) {
    const { error } = await supabase.from("lessons").delete().in("id", unmarked);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error } = await supabase
    .from("lesson_slots")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
