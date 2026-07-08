import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateShortToken } from "@/lib/token";
import { sendEmail } from "@/lib/email";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const { studentId, notifyFamily } = await req.json();

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
    .select("id, name")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Verify student belongs to teacher
  const { data: student } = await supabase
    .from("students")
    .select("id, name, guardians ( name, email, portal_token )")
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Check if assignment already exists (idempotent — reuse the token)
  const serviceClient = createServiceClient();
  const { data: existing } = await serviceClient
    .from("student_plans")
    .select("id, token")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .single();

  let token = existing?.token ?? null;

  if (!token) {
    // Generate short token (8 chars); retry on collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateShortToken();
      const { data, error } = await serviceClient
        .from("student_plans")
        .insert({
          student_id: studentId,
          plan_id: planId,
          token: candidate,
        })
        .select("token")
        .single();

      if (!error) {
        token = data.token;
        break;
      }
      if (error.code === "23505") {
        // Unique violation (token collision) — retry
        continue;
      }
      console.error("Failed to assign plan:", error);
      return NextResponse.json({ error: "Failed to assign plan" }, { status: 500 });
    }

    if (!token) {
      return NextResponse.json({ error: "Failed to assign plan" }, { status: 500 });
    }
  }

  // Email the family when requested and an email is on file. If this fails
  // (or no email exists), the client falls back to share/copy — assigning
  // never fails because email did.
  let emailed = false;
  let emailedTo: string | undefined;
  let emailError: string | undefined;

  const guardian = student.guardians as unknown as {
    name: string;
    email: string | null;
    portal_token: string | null;
  } | null;

  if (notifyFamily && guardian?.email) {
    const origin = requestOrigin(req);
    const practiceUrl = `${origin}/practice/${token}`;
    const policy = await getPolicy(supabase, user.id);
    const signature = policy.studio_name
      ? `— ${policy.studio_name} (sent via CogNote Studio)`
      : "— Sent via CogNote Studio";

    const result = await sendEmail({
      to: guardian.email,
      subject: `New practice assignment for ${student.name}: ${plan.name}`,
      text: `Hi ${guardian.name},\n\n${student.name} has a new practice assignment: "${plan.name}".\n\nStart practicing here:\n${practiceUrl}\n\n${signature}`,
      fromName: policy.studio_name
        ? `${policy.studio_name} (via CogNote)`
        : undefined,
      // Parent replies go to the teacher, never to the platform.
      replyTo: user.email,
      portalUrl: guardian.portal_token
        ? `${origin}/portal/${guardian.portal_token}`
        : undefined,
    });
    emailed = result.sent;
    emailedTo = result.sent ? guardian.name : undefined;
    emailError = result.error;
  }

  return NextResponse.json({ token, emailed, emailedTo, emailError });
}
