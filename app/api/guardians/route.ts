import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShortToken } from "@/lib/token";

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
    .select("id, name, email, phone, portal_token, created_at, students ( id, name )")
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

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const emailRecipients = ["primary", "secondary", "both"].includes(
    body.emailRecipients
  )
    ? body.emailRecipients
    : "primary";

  const { data: guardian, error } = await supabase
    .from("guardians")
    .insert({
      teacher_id: user.id,
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      secondary_name: body.secondaryName?.trim() || null,
      secondary_email: body.secondaryEmail?.trim() || null,
      secondary_phone: body.secondaryPhone?.trim() || null,
      email_recipients: emailRecipients,
      portal_token: generateShortToken(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
    await supabase
      .from("students")
      .update({ guardian_id: guardian.id })
      .in("id", body.studentIds)
      .eq("teacher_id", user.id);
  }

  // Brand-new students created inline with the family (onboarding flow)
  if (Array.isArray(body.newStudents)) {
    const rows = body.newStudents
      .filter((s: { name?: string }) => s?.name?.trim())
      .map((s: { name: string; birthdate?: string }) => ({
        teacher_id: user.id,
        name: s.name.trim(),
        guardian_id: guardian.id,
        birthdate: s.birthdate || null,
      }));
    if (rows.length > 0) {
      await supabase.from("students").insert(rows);
    }
  }

  return NextResponse.json(guardian);
}
