import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retireEmptyGuardians } from "@/lib/server/families";
import { parseBody, studentUpdateSchema } from "@/lib/server/api-schemas";

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

  const parsed = parseBody(studentUpdateSchema, await req.json().catch(() => null));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  let previousGuardianId: string | null = null;
  if (body.guardianId !== undefined) {
    const { data: existing } = await supabase
      .from("students")
      .select("guardian_id")
      .eq("id", id)
      .eq("teacher_id", user.id)
      .maybeSingle();
    previousGuardianId = existing?.guardian_id ?? null;

    // Linking a foreign family would surface this student on another
    // teacher's portal.
    if (body.guardianId) {
      const { data: owned } = await supabase
        .from("guardians")
        .select("id")
        .eq("id", body.guardianId)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (!owned) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }
    }
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
      ...(body.practiceStartDate !== undefined && {
        practice_start_date: body.practiceStartDate || null,
      }),
      ...(body.defaultRateCents !== undefined && {
        default_rate_cents:
          body.defaultRateCents === null || body.defaultRateCents === ""
            ? null
            : Math.max(0, Math.round(Number(body.defaultRateCents))),
      }),
      ...(body.archived !== undefined && {
        archived_at: body.archived ? new Date().toISOString() : null,
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
