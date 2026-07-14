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
  const update: Record<string, unknown> = {
    name: body.name?.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
  };
  if (body.familyName !== undefined)
    update.family_name = body.familyName?.trim() || null;
  if (body.secondaryName !== undefined)
    update.secondary_name = body.secondaryName?.trim() || null;
  if (body.secondaryEmail !== undefined)
    update.secondary_email = body.secondaryEmail?.trim() || null;
  if (body.secondaryPhone !== undefined)
    update.secondary_phone = body.secondaryPhone?.trim() || null;
  if (["primary", "secondary", "both"].includes(body.emailRecipients))
    update.email_recipients = body.emailRecipients;

  const { data: guardian, error } = await supabase
    .from("guardians")
    .update(update)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const previousGuardianIds: string[] = [];

  if (Array.isArray(body.studentIds)) {
    if (body.studentIds.length > 0) {
      const { data: moving } = await supabase
        .from("students")
        .select("id, guardian_id")
        .in("id", body.studentIds)
        .eq("teacher_id", user.id);
      for (const s of moving ?? []) {
        if (s.guardian_id && s.guardian_id !== id) {
          previousGuardianIds.push(s.guardian_id);
        }
      }
    }

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

  if (Array.isArray(body.newStudents)) {
    const rows = body.newStudents
      .filter((s: { name?: string }) => s?.name?.trim())
      .map((s: { name: string; birthdate?: string }) => ({
        teacher_id: user.id,
        name: s.name.trim(),
        guardian_id: id,
        birthdate: s.birthdate || null,
      }));
    if (rows.length > 0) {
      const {
        assertWithinHostedLimit,
        limitReachedResponse,
      } = await import("@/lib/server/entitlements");
      const limitCheck = await assertWithinHostedLimit(
        supabase,
        user.id,
        "students",
        rows.length
      );
      if (!limitCheck.allowed) {
        return NextResponse.json(limitReachedResponse(limitCheck), {
          status: 403,
        });
      }
      await supabase.from("students").insert(rows);
    }
  }

  await retireEmptyGuardians(supabase, user.id, previousGuardianIds);

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
