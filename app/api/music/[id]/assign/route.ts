import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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
  const { id: musicItemId } = await params;
  const body = await req.json();
  const studentId = body.studentId as string | undefined;
  const notifyFamily = Boolean(body.notifyFamily);
  const assignmentNote =
    typeof body.assignmentNote === "string" ? body.assignmentNote.trim() : "";
  const dueDate =
    typeof body.dueDate === "string" && body.dueDate.trim()
      ? body.dueDate.trim()
      : null;

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

  const { data: item } = await supabase
    .from("music_library_items")
    .select("id, title, composer")
    .eq("id", musicItemId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Score not found" }, { status: 404 });
  }

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, name, guardians ( name, email, secondary_name, secondary_email, email_recipients, portal_token )"
    )
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const service = createServiceClient();

  const { data: activeRows, error: activeErr } = await service
    .from("sheet_music_assignments")
    .select("id, emailed_at")
    .eq("music_item_id", musicItemId)
    .eq("student_id", studentId)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1);

  if (activeErr) {
    console.error("sheet music active lookup:", activeErr);
    return NextResponse.json(
      { error: "Could not check existing assignments" },
      { status: 500 }
    );
  }

  const active = activeRows?.[0] ?? null;
  if (active) {
    return NextResponse.json({
      assignmentId: active.id,
      alreadyAssigned: true,
      emailed: false,
    });
  }

  const { data: archivedRows } = await service
    .from("sheet_music_assignments")
    .select("id")
    .eq("music_item_id", musicItemId)
    .eq("student_id", studentId)
    .not("unassigned_at", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(1);

  const archived = archivedRows?.[0] ?? null;
  let assignmentId: string | null = null;
  let emailedAt: string | null = null;

  if (archived) {
    const { data: reactivated, error: reactivateError } = await service
      .from("sheet_music_assignments")
      .update({
        unassigned_at: null,
        assigned_at: new Date().toISOString(),
        assignment_note: assignmentNote,
        due_date: dueDate,
        emailed_at: null,
      })
      .eq("id", archived.id)
      .select("id")
      .single();

    if (reactivateError || !reactivated) {
      console.error("sheet music reactivate:", reactivateError);
      return NextResponse.json({ error: "Failed to reassign" }, { status: 500 });
    }
    assignmentId = reactivated.id;
  } else {
    const { data: inserted, error: insertError } = await service
      .from("sheet_music_assignments")
      .insert({
        music_item_id: musicItemId,
        student_id: studentId,
        assignment_note: assignmentNote,
        due_date: dueDate,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === "23505") {
        return NextResponse.json({
          alreadyAssigned: true,
          emailed: false,
        });
      }
      console.error("sheet music assign:", insertError);
      return NextResponse.json({ error: "Failed to assign" }, { status: 500 });
    }
    assignmentId = inserted.id;
  }

  let emailed = false;
  let emailError: string | undefined;

  const guardian = student.guardians as unknown as
    | (FamilyContact & { portal_token: string | null })
    | null;
  const recipients = guardian ? familyEmailRecipients(guardian) : [];

  if (notifyFamily && guardian && recipients.length > 0) {
    const origin = requestOrigin(req);
    const policy = await getPolicy(supabase, user.id);
    const signature = policy.studio_name
      ? `— ${policy.studio_name} (sent via CogNote Studio)`
      : "— Sent via CogNote Studio";
    const portalUrl = guardian.portal_token
      ? `${origin}/portal/${guardian.portal_token}`
      : undefined;
    const composerBit = item.composer ? ` by ${item.composer}` : "";
    const noteBit = assignmentNote ? `\n\nNote from teacher:\n${assignmentNote}` : "";
    const dueBit = dueDate ? `\nDue: ${dueDate}` : "";

    const result = await sendEmail({
      to: recipients,
      subject: `New sheet music for ${student.name}: ${item.title}`,
      text: `Hi ${familyGreetingNames(guardian)},\n\n${student.name} has new sheet music: "${item.title}"${composerBit}.${noteBit}${dueBit}\n\nView it in the family portal:\n${portalUrl ?? "(ask your teacher for the portal link)"}\n\n${signature}`,
      fromName: policy.studio_name
        ? `${policy.studio_name} (via CogNote)`
        : undefined,
      replyTo: user.email,
      portalUrl,
    });

    emailed = result.sent;
    emailError = result.error;
    if (result.sent) {
      emailedAt = new Date().toISOString();
      await service
        .from("sheet_music_assignments")
        .update({ emailed_at: emailedAt })
        .eq("id", assignmentId);
    }
  }

  return NextResponse.json({
    assignmentId,
    alreadyAssigned: false,
    emailed,
    emailError,
  });
}
