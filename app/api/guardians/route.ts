import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  insertGuardian,
  retireEmptyGuardians,
} from "@/lib/server/families";
import { parseBody, guardianCreateSchema } from "@/lib/server/api-schemas";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("guardians")
    .select(
      "id, name, family_name, email, phone, secondary_name, secondary_email, secondary_phone, email_recipients, portal_token, created_at, students ( id, name )"
    )
    .eq("teacher_id", user.id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseBody(guardianCreateSchema, await req.json().catch(() => null));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const emailRecipients = body.emailRecipients ?? "primary";

  const previousGuardianIds: string[] = [];
  if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
    const { data: moving } = await supabase
      .from("students")
      .select("id, guardian_id")
      .in("id", body.studentIds)
      .eq("teacher_id", user.id);
    for (const s of moving ?? []) {
      if (s.guardian_id) previousGuardianIds.push(s.guardian_id);
    }
  }

  const { data: guardian, error } = await insertGuardian(supabase, user.id, {
    name: body.name,
    familyName: body.familyName,
    email: body.email,
    phone: body.phone,
    secondaryName: body.secondaryName,
    secondaryEmail: body.secondaryEmail,
    secondaryPhone: body.secondaryPhone,
    emailRecipients,
  });

  if (error || !guardian) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create family" },
      { status: 500 }
    );
  }

  if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
    await supabase
      .from("students")
      .update({ guardian_id: guardian.id })
      .in("id", body.studentIds)
      .eq("teacher_id", user.id);
  }

  if (Array.isArray(body.newStudents)) {
    const rows = body.newStudents
      .filter((s) => s.name.trim())
      .map((s) => ({
        teacher_id: user.id,
        name: s.name.trim(),
        guardian_id: guardian.id,
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

  await retireEmptyGuardians(
    supabase,
    user.id,
    previousGuardianIds.filter((id) => id !== guardian.id)
  );

  return NextResponse.json(guardian);
}
