import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import { addDays, toLocalDateString } from "@/lib/schedule";

/**
 * Future occurrences of a slot that have no attendance yet are disposable
 * projections — when the slot changes or is deleted we remove them and
 * re-materialize. Marked lessons (attendance exists) are history and stay.
 */
async function deleteFutureUnmarkedLessons(
  supabase: SupabaseClient,
  slotId: string,
  fromDate: string
) {
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, attendance ( id )")
    .eq("slot_id", slotId)
    .gte("lesson_date", fromDate);

  const unmarked = (lessons ?? [])
    .filter((l: { attendance: unknown[] | null }) => !l.attendance?.length)
    .map((l: { id: string }) => l.id);

  if (unmarked.length > 0) {
    await supabase.from("lessons").delete().in("id", unmarked);
  }
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

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.dayOfWeek !== undefined) update.day_of_week = Number(body.dayOfWeek);
  if (body.startTime !== undefined) update.start_time = body.startTime;
  if (body.durationMinutes !== undefined)
    update.duration_minutes = Number(body.durationMinutes);
  if (body.startDate !== undefined) update.start_date = body.startDate;
  if (body.endDate !== undefined) update.end_date = body.endDate || null;
  if (body.active !== undefined) update.active = Boolean(body.active);

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

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  await deleteFutureUnmarkedLessons(supabase, id, today);
  await materializeLessons(supabase, user.id, today, addDays(today, 56));

  return NextResponse.json(slot);
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

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  await deleteFutureUnmarkedLessons(supabase, id, today);

  // Past lessons keep their history; slot_id becomes NULL via FK
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
