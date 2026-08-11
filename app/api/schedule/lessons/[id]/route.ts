import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (body.isHomeVisit !== undefined) {
    update.is_home_visit = Boolean(body.isHomeVisit);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lessons")
    .update(update)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id, is_home_visit")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
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
