import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const { studentId } = await req.json();

  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify plan belongs to teacher
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Verify student belongs to teacher
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Generate token
  let token: string;
  try {
    token = encryptToken({
      studentId,
      planId,
      teacherId: user.id,
    });
  } catch {
    // Fallback for dev without TOKEN_ENCRYPTION_KEY
    token = `dev-${studentId.slice(0, 8)}-${planId.slice(0, 8)}`;
  }

  // Check if assignment already exists
  const serviceClient = createServiceClient();
  const { data: existing } = await serviceClient
    .from("student_plans")
    .select("id, token")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .single();

  if (existing) {
    return NextResponse.json({ token: existing.token });
  }

  const { data: studentPlan, error } = await serviceClient
    .from("student_plans")
    .insert({
      student_id: studentId,
      plan_id: planId,
      token,
    })
    .select("token")
    .single();

  if (error) {
    console.error("Failed to assign plan:", error);
    return NextResponse.json({ error: "Failed to assign plan" }, { status: 500 });
  }

  return NextResponse.json({ token: studentPlan.token });
}
