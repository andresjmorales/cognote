import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { data: guardian, error } = await supabase
    .from("guardians")
    .update({
      name: body.name?.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
    })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync membership: studentIds is the full desired set for this family
  if (Array.isArray(body.studentIds)) {
    await supabase
      .from("students")
      .update({ guardian_id: null })
      .eq("guardian_id", id)
      .eq("teacher_id", user.id);
    if (body.studentIds.length > 0) {
      await supabase
        .from("students")
        .update({ guardian_id: id })
        .in("id", body.studentIds)
        .eq("teacher_id", user.id);
    }
  }

  return NextResponse.json(guardian);
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

  // students.guardian_id is ON DELETE SET NULL — students are kept
  const { error } = await supabase
    .from("guardians")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
