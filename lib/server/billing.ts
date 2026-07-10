import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveInvoiceItems,
  type BillableLessonInput,
  type InvoiceItemDraft,
} from "@/lib/billing";
import type { StudioPolicy } from "@/lib/schedule";
import { oneToOne } from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";

interface LessonRow {
  id: string;
  student_id: string;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
  makeup_for: string | null;
  slot_id: string | null;
  students:
    | {
        id: string;
        name: string;
        guardian_id: string | null;
        default_rate_cents: number | null;
      }
    | {
        id: string;
        name: string;
        guardian_id: string | null;
        default_rate_cents: number | null;
      }[]
    | null;
  lesson_slots:
    | { rate_cents: number | null }
    | { rate_cents: number | null }[]
    | null;
  attendance:
    | { status: AttendanceStatus; notice_at: string | null }[]
    | { status: AttendanceStatus; notice_at: string | null }
    | null;
}

export interface DerivePeriodOptions {
  /** Only include lessons for this family. */
  guardianId?: string;
  /**
   * Lesson IDs already on a non-void invoice. Skipped to prevent double-billing.
   * Pass an empty set to include everything (e.g. regenerate owning those lessons).
   */
  excludeLessonIds?: Set<string>;
}

/**
 * Lesson IDs that already appear on a draft/sent/paid invoice for this teacher.
 * Void invoices do not reserve lessons. Optionally ignore one invoice (regenerate).
 */
export async function getInvoicedLessonIds(
  supabase: SupabaseClient,
  teacherId: string,
  opts?: { exceptInvoiceId?: string }
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("lesson_id, invoices!inner ( id, teacher_id, status )")
    .not("lesson_id", "is", null)
    .eq("invoices.teacher_id", teacherId)
    .in("invoices.status", ["draft", "sent", "paid"]);

  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const invoice = oneToOne(
      row.invoices as
        | { id: string; status: string }
        | { id: string; status: string }[]
        | null
    );
    if (!invoice) continue;
    if (opts?.exceptInvoiceId && invoice.id === opts.exceptInvoiceId) continue;
    if (row.lesson_id) ids.add(row.lesson_id);
  }
  return ids;
}

/**
 * Load marked lessons in [periodStart, periodEnd] and derive draft invoice
 * items under the teacher's billing policy.
 */
export async function derivePeriodItems(
  supabase: SupabaseClient,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  policy: StudioPolicy,
  options: DerivePeriodOptions = {}
): Promise<{ items: InvoiceItemDraft[]; skippedAlreadyInvoiced: number }> {
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select(
      `
      id, student_id, lesson_date, starts_at, duration_minutes, makeup_for, slot_id,
      students ( id, name, guardian_id, default_rate_cents ),
      lesson_slots ( rate_cents ),
      attendance!lesson_id ( status, notice_at )
    `
    )
    .eq("teacher_id", teacherId)
    .gte("lesson_date", periodStart)
    .lte("lesson_date", periodEnd)
    .order("lesson_date");

  if (error) throw new Error(error.message);

  const exclude = options.excludeLessonIds ?? new Set<string>();
  let skippedAlreadyInvoiced = 0;
  const inputs: BillableLessonInput[] = [];

  for (const raw of (lessons ?? []) as LessonRow[]) {
    const attendance = oneToOne(raw.attendance);
    if (!attendance) continue;
    const student = oneToOne(raw.students);
    if (!student) continue;
    if (options.guardianId && student.guardian_id !== options.guardianId) {
      continue;
    }
    if (exclude.has(raw.id)) {
      skippedAlreadyInvoiced += 1;
      continue;
    }
    const slot = oneToOne(raw.lesson_slots);

    inputs.push({
      lessonId: raw.id,
      studentId: student.id,
      studentName: student.name,
      guardianId: student.guardian_id,
      lessonDate: raw.lesson_date,
      startsAt: raw.starts_at,
      durationMinutes: raw.duration_minutes,
      makeupFor: raw.makeup_for,
      attendanceStatus: attendance.status,
      noticeAt: attendance.notice_at,
      rate: {
        slotRateCents: slot?.rate_cents ?? null,
        studentDefaultRateCents: student.default_rate_cents,
        studioDefaultRateCents: policy.default_rate_cents,
      },
    });
  }

  return {
    items: deriveInvoiceItems(inputs, policy),
    skippedAlreadyInvoiced,
  };
}
