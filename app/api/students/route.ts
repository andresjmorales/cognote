import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStudentWithOptionalFamily } from "@/lib/server/families";
import { parseBody, studentCreateSchema } from "@/lib/server/api-schemas";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("students")
    .select("*")
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

  const {
    assertWithinHostedLimit,
    limitReachedResponse,
  } = await import("@/lib/server/entitlements");
  const limitCheck = await assertWithinHostedLimit(supabase, user.id, "students");
  if (!limitCheck.allowed) {
    return NextResponse.json(limitReachedResponse(limitCheck), { status: 403 });
  }

  const parsed = parseBody(studentCreateSchema, await req.json().catch(() => null));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await createStudentWithOptionalFamily(supabase, user.id, {
    name: body.name,
    birthdate: body.birthdate ?? null,
    level: body.level ?? null,
    teacherNotes: body.teacherNotes ?? null,
    guardianId: body.guardianId ?? null,
    contactEmail: body.contactEmail ?? null,
    contactPhone: body.contactPhone ?? null,
    contactName: body.contactName ?? null,
    adultSelf: Boolean(body.adultSelf),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { ...result.student, createdFamily: result.createdFamily },
    { status: 201 }
  );
}
