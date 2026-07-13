import type { SupabaseClient } from "@supabase/supabase-js";
import { generateShortToken } from "@/lib/token";

export interface CreateGuardianInput {
  name: string;
  familyName?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryName?: string | null;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  emailRecipients?: "primary" | "secondary" | "both";
}

export async function insertGuardian(
  supabase: SupabaseClient,
  teacherId: string,
  input: CreateGuardianInput
) {
  const emailRecipients = ["primary", "secondary", "both"].includes(
    input.emailRecipients ?? ""
  )
    ? input.emailRecipients!
    : "primary";

  return supabase
    .from("guardians")
    .insert({
      teacher_id: teacherId,
      name: input.name.trim(),
      family_name: input.familyName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      secondary_name: input.secondaryName?.trim() || null,
      secondary_email: input.secondaryEmail?.trim() || null,
      secondary_phone: input.secondaryPhone?.trim() || null,
      email_recipients: emailRecipients,
      portal_token: generateShortToken(),
    })
    .select()
    .single();
}

export interface CreateStudentInput {
  name: string;
  birthdate?: string | null;
  level?: string | null;
  teacherNotes?: string | null;
  guardianId?: string | null;
  /** Create a singleton family when set (and no guardianId). */
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  /** Family named after the student; contact is the student. */
  adultSelf?: boolean;
}

/**
 * Create a student, optionally linking an existing family or auto-creating a
 * singleton "family of one" when contact info / adultSelf is provided.
 */
export async function createStudentWithOptionalFamily(
  supabase: SupabaseClient,
  teacherId: string,
  input: CreateStudentInput
): Promise<
  | { ok: true; student: Record<string, unknown>; createdFamily: boolean }
  | { ok: false; error: string; status: number }
> {
  const name = input.name?.trim();
  if (!name) {
    return { ok: false, error: "Name is required", status: 400 };
  }

  let guardianId = input.guardianId?.trim() || null;
  let createdFamily = false;

  if (!guardianId) {
    const email = input.contactEmail?.trim() || null;
    const phone = input.contactPhone?.trim() || null;
    const adultSelf = Boolean(input.adultSelf);
    const contactName = input.contactName?.trim() || null;

    // Practice-only: no adult flag and no contact channels.
    // Portal family-of-one: Adult student, OR parent name + email/phone.
    if (email || phone || adultSelf) {
      if (!adultSelf && !contactName) {
        return {
          ok: false,
          error:
            "Parent / guardian name is required unless Adult student is checked",
          status: 400,
        };
      }
      const { data: guardian, error: gErr } = await insertGuardian(
        supabase,
        teacherId,
        {
          name: contactName || name,
          familyName: adultSelf ? name : null,
          email,
          phone,
        }
      );
      if (gErr || !guardian) {
        return {
          ok: false,
          error: gErr?.message ?? "Failed to create family",
          status: 500,
        };
      }
      guardianId = guardian.id;
      createdFamily = true;
    } else if (contactName) {
      return {
        ok: false,
        error:
          "Add an email or phone for the parent, or check Adult student, or clear the parent name for practice-only",
        status: 400,
      };
    }
  }

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      teacher_id: teacherId,
      name,
      guardian_id: guardianId,
      birthdate: input.birthdate || null,
      level: input.level?.trim() || null,
      teacher_notes: input.teacherNotes?.trim() || "",
    })
    .select()
    .single();

  if (error || !student) {
    return {
      ok: false,
      error: error?.message ?? "Failed to create student",
      status: 500,
    };
  }

  return { ok: true, student, createdFamily };
}

/**
 * Delete guardians that have no students and no invoices (RESTRICTed FK).
 * Used after moving the last member out of a singleton family.
 */
export async function retireEmptyGuardians(
  supabase: SupabaseClient,
  teacherId: string,
  guardianIds: string[]
): Promise<{ retired: string[] }> {
  const unique = [...new Set(guardianIds.filter(Boolean))];
  const retired: string[] = [];

  for (const id of unique) {
    const { count: studentCount } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("guardian_id", id);

    if ((studentCount ?? 0) > 0) continue;

    const { count: invoiceCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("guardian_id", id);

    if ((invoiceCount ?? 0) > 0) continue;

    const { error } = await supabase
      .from("guardians")
      .delete()
      .eq("id", id)
      .eq("teacher_id", teacherId);

    if (!error) retired.push(id);
  }

  return { retired };
}
