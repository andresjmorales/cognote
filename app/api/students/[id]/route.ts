import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retireEmptyGuardians } from "@/lib/server/families";

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

  let previousGuardianId: string | null = null;
  if (body.guardianId !== undefined) {
    const { data: existing } = await supabase
      .from("students")
      .select("guardian_id")
      .eq("id", id)
      .eq("teacher_id", user.id)
      .maybeSingle();
    previousGuardianId = existing?.guardian_id ?? null;
  }

  const { data, error } = await supabase
    .from("students")
    .update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.parentContact !== undefined && {
        parent_contact: body.parentContact,
      }),
      ...(body.guardianId !== undefined && {
        guardian_id: body.guardianId || null,
      }),
      ...(body.level !== undefined && { level: body.level?.trim() || null }),
      ...(body.birthdate !== undefined && { birthdate: body.birthdate || null }),
      ...(body.defaultRateCents !== undefined && {
        default_rate_cents:
          body.defaultRateCents === null || body.defaultRateCents === ""
            ? null
            : Math.max(0, Math.round(Number(body.defaultRateCents))),
      }),
    })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (
    previousGuardianId &&
    previousGuardianId !== (body.guardianId || null)
  ) {
    await retireEmptyGuardians(supabase, user.id, [previousGuardianId]);
  }

  return NextResponse.json(data);
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

  const { data: existing } = await supabase
    .from("students")
    .select("guardian_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing?.guardian_id) {
    await retireEmptyGuardians(supabase, user.id, [existing.guardian_id]);
  }

  return NextResponse.json({ ok: true });
}
