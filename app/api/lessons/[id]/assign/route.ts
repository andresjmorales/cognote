import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateShortToken } from "@/lib/token";
import { sendEmail } from "@/lib/email";
import {
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
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
    .select(
      "id, name, guardians ( name, email, secondary_name, secondary_email, email_recipients, portal_token )"
    )
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // An already-active assignment is idempotent: reuse the existing token and
  // never re-email the family. Legacy databases may have duplicate rows, so
  // deliberately choose the newest active assignment instead of using .single().
  const serviceClient = createServiceClient();
  const { data: activeAssignments, error: activeLookupError } = await serviceClient
    .from("student_plans")
    .select("id, token, unassigned_at")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1);

  if (activeLookupError) {
    console.error("Failed to look up active assignment:", activeLookupError);
    return NextResponse.json(
      { error: "Could not check existing assignments" },
      { status: 500 }
    );
  }

  const activeAssignment = activeAssignments?.[0] ?? null;
  if (activeAssignment) {
    return NextResponse.json({
      token: activeAssignment.token,
      alreadyAssigned: true,
      emailed: false,
    });
  }

  // Re-activate the newest past assignment when one exists, preserving its
  // token and practice history. This is a fresh assignment, so it may notify.
  const { data: archivedAssignments, error: archivedLookupError } =
    await serviceClient
      .from("student_plans")
      .select("id, token")
      .eq("student_id", studentId)
      .eq("plan_id", planId)
      .not("unassigned_at", "is", null)
      .order("assigned_at", { ascending: false })
      .limit(1);

  if (archivedLookupError) {
    console.error("Failed to look up past assignment:", archivedLookupError);
    return NextResponse.json(
      { error: "Could not check previous assignments" },
      { status: 500 }
    );
  }

  const archivedAssignment = archivedAssignments?.[0] ?? null;
  let token = archivedAssignment?.token ?? null;

  if (archivedAssignment) {
    const { error: reactivateError } = await serviceClient
      .from("student_plans")
      .update({ unassigned_at: null, assigned_at: new Date().toISOString() })
      .eq("id", archivedAssignment.id);
    if (reactivateError) {
      console.error("Failed to re-activate assignment:", reactivateError);
      return NextResponse.json({ error: "Failed to reassign lesson" }, { status: 500 });
    }
  }

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
        // Either a rare token collision, or a concurrent assignment. Prefer
        // the now-active assignment rather than emitting a duplicate email.
        const { data: concurrentAssignments } = await serviceClient
          .from("student_plans")
          .select("token")
          .eq("student_id", studentId)
          .eq("plan_id", planId)
          .is("unassigned_at", null)
          .order("assigned_at", { ascending: false })
          .limit(1);
        const concurrentAssignment = concurrentAssignments?.[0] ?? null;
        if (concurrentAssignment) {
          return NextResponse.json({
            token: concurrentAssignment.token,
            alreadyAssigned: true,
            emailed: false,
          });
        }
        // Otherwise this was a token collision — retry.
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

  const guardian = student.guardians as unknown as
    | (FamilyContact & { portal_token: string | null })
    | null;
  const recipients = guardian ? familyEmailRecipients(guardian) : [];

  if (notifyFamily && guardian && recipients.length > 0) {
    const origin = requestOrigin(req);
    const practiceUrl = `${origin}/practice/${token}`;
    const policy = await getPolicy(supabase, user.id);
    const signature = policy.studio_name
      ? `— ${policy.studio_name} (sent via CogNote Studio)`
      : "— Sent via CogNote Studio";

    const result = await sendEmail({
      to: recipients,
      subject: `New practice assignment for ${student.name}: ${plan.name}`,
      text: `Hi ${familyGreetingNames(guardian)},\n\n${student.name} has a new practice assignment: "${plan.name}".\n\nStart practicing here:\n${practiceUrl}\n\n${signature}`,
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
