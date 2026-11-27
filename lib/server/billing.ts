import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveInvoiceItems,
  groupItemsByGuardian,
  isBillable,
  sumAmountCents,
  type BillableLessonInput,
  type InvoiceItemDraft,
} from "@/lib/billing";
import {
  allocateCredits,
  type CreditCandidate,
  type CreditPackageInput,
} from "@/lib/credits";
import { loadCreditInputs, recordRedemptions } from "@/lib/server/credits";
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
  is_home_visit: boolean | null;
  students:
    | {
        id: string;
        name: string;
        guardian_id: string | null;
        default_rate_cents: number | null;
        travel_fee_cents: number | null;
      }
    | {
        id: string;
        name: string;
        guardian_id: string | null;
        default_rate_cents: number | null;
        travel_fee_cents: number | null;
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
  /** Lessons whose travel fee is already on a non-void invoice. */
  travelInvoicedLessonIds?: Set<string>;
  /**
   * Prepaid credits (lib/server/credits.ts loadCreditInputs). Lessons already
   * redeemed skip their lesson line; billable lessons a package covers get a
   * new credit, returned in `newRedemptions` for the caller to record.
   */
  credits?: {
    packages: CreditPackageInput[];
    redeemedLessonIds: Set<string>;
  };
}

export interface DerivedPeriod {
  items: InvoiceItemDraft[];
  skippedAlreadyInvoiced: number;
  /** lessonId → packageId for lessons newly covered by a credit. */
  newRedemptions: Map<string, string>;
  /** Lessons newly covered by a credit, per guardian. */
  creditedByGuardian: Map<string, number>;
}

/**
 * Lesson IDs that already appear on a draft/sent/paid invoice for this teacher.
 * Void invoices do not reserve lessons. Optionally ignore one invoice (regenerate).
 * `kind` picks the line: "lesson" (default) for the lesson charge, "travel"
 * for its travel fee. They differ when a prepaid credit paid the lesson.
 */
export async function getInvoicedLessonIds(
  supabase: SupabaseClient,
  teacherId: string,
  opts?: { exceptInvoiceId?: string; kind?: "lesson" | "travel" }
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("lesson_id, invoices!inner ( id, teacher_id, status )")
    .not("lesson_id", "is", null)
    .eq("kind", opts?.kind ?? "lesson")
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
 * items under the teacher's billing policy, applying prepaid credits.
 */
export async function derivePeriodItems(
  supabase: SupabaseClient,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  policy: StudioPolicy,
  options: DerivePeriodOptions = {}
): Promise<DerivedPeriod> {
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select(
      `
      id, student_id, lesson_date, starts_at, duration_minutes, makeup_for, slot_id, is_home_visit,
      students ( id, name, guardian_id, default_rate_cents, travel_fee_cents ),
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
    // Snapshot on the lesson only — never inherit the live slot flag, so
    // toggling a weekly slot's home-visit setting does not rewrite past
    // occurrences when regenerating invoices.
    const isHomeVisit = Boolean(raw.is_home_visit);

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
      isHomeVisit,
      rate: {
        slotRateCents: slot?.rate_cents ?? null,
        studentDefaultRateCents: student.default_rate_cents,
        studioDefaultRateCents: policy.default_rate_cents,
        durationRateCents:
          policy.duration_rate_cents[raw.duration_minutes] ?? null,
      },
      travel: {
        studentTravelFeeCents: student.travel_fee_cents,
        studioTravelFeeCents: policy.travel_fee_cents,
      },
    });
  }

  const redeemed = options.credits?.redeemedLessonIds ?? new Set<string>();
  const billable = inputs.filter(
    (lesson) => lesson.guardianId && isBillable(lesson, policy)
  );
  const candidates: CreditCandidate[] = billable
    .filter((lesson) => !redeemed.has(lesson.lessonId))
    .map((lesson) => ({
      lessonId: lesson.lessonId,
      studentId: lesson.studentId,
      lessonDate: lesson.lessonDate,
      startsAt: lesson.startsAt,
      durationMinutes: lesson.durationMinutes,
    }));
  const newRedemptions = options.credits
    ? allocateCredits(candidates, options.credits.packages)
    : new Map<string, string>();

  const creditedLessonIds = new Set([...redeemed, ...newRedemptions.keys()]);
  const creditedByGuardian = new Map<string, number>();
  for (const lesson of billable) {
    if (!newRedemptions.has(lesson.lessonId)) continue;
    const guardianId = lesson.guardianId!;
    creditedByGuardian.set(
      guardianId,
      (creditedByGuardian.get(guardianId) ?? 0) + 1
    );
  }

  return {
    items: deriveInvoiceItems(inputs, policy, {
      creditedLessonIds,
      travelInvoicedLessonIds: options.travelInvoicedLessonIds,
    }),
    skippedAlreadyInvoiced,
    newRedemptions,
    creditedByGuardian,
  };
}

/**
 * The three lookups every caller needs before deriving: lessons already
 * invoiced (lesson and travel lines separately), and prepaid credit inputs.
 */
export async function deriveForPeriod(
  supabase: SupabaseClient,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  policy: StudioPolicy
): Promise<DerivedPeriod> {
  const [excludeLessonIds, travelInvoicedLessonIds, credits] = await Promise.all([
    getInvoicedLessonIds(supabase, teacherId),
    getInvoicedLessonIds(supabase, teacherId, { kind: "travel" }),
    loadCreditInputs(supabase, teacherId),
  ]);

  return derivePeriodItems(supabase, teacherId, periodStart, periodEnd, policy, {
    excludeLessonIds,
    travelInvoicedLessonIds,
    credits,
  });
}

export interface DraftInvoiceSummary {
  guardianId: string;
  familyName: string;
  subtotalCents: number;
  missingRateCount: number;
  creditedLessonCount: number;
}

export interface CreateDraftInvoicesResult {
  created: string[];
  skippedAlreadyInvoiced: number;
  creditsUsed: number;
  error?: string;
}

/**
 * Create one DRAFT invoice per family with billable lessons in the period, and
 * record any prepaid credit redemptions the period consumed.
 *
 * Credits are recorded FIRST: the database refuses a redemption for a lesson
 * that is already invoiced, so writing the lines first would fail the run. A
 * period can legitimately consume credits and produce no invoices at all.
 *
 * Never sends. Draft is the only editable invoice state, so a wrong auto-sent
 * invoice would be permanently wrong.
 */
export async function createDraftInvoices(
  supabase: SupabaseClient,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  policy: StudioPolicy,
  opts: { skipAlreadyDrafted?: boolean } = {}
): Promise<CreateDraftInvoicesResult> {
  const { items, skippedAlreadyInvoiced, newRedemptions } =
    await deriveForPeriod(supabase, teacherId, periodStart, periodEnd, policy);

  const groups = groupItemsByGuardian(items);
  let guardianIds = [...groups.keys()];

  if (opts.skipAlreadyDrafted && guardianIds.length) {
    // Belt and braces beside the lesson-level gate, for the cron only: the
    // teacher's own commit route must stay able to replace an invoice they
    // voided. ANY status counts here (void included), because the question is
    // whether this family+period was already attempted, and two overlapping
    // runs can both find an empty covered-lesson set.
    const { data: existing, error: existingError } = await supabase
      .from("invoices")
      .select("guardian_id")
      .eq("teacher_id", teacherId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .in("guardian_id", guardianIds);
    if (existingError) throw new Error(existingError.message);
    const covered = new Set(
      (existing ?? []).map((row) => row.guardian_id as string)
    );
    guardianIds = guardianIds.filter((id) => !covered.has(id));
  }

  const redemptionError = await recordRedemptions(supabase, teacherId, newRedemptions);
  if (redemptionError) {
    return {
      created: [],
      skippedAlreadyInvoiced,
      creditsUsed: 0,
      error: redemptionError,
    };
  }

  const created: string[] = [];
  for (const guardianId of guardianIds) {
    const lineItems = groups.get(guardianId)!;
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        teacher_id: teacherId,
        guardian_id: guardianId,
        period_start: periodStart,
        period_end: periodEnd,
        status: "draft",
        source: "lessons",
        subtotal_cents: sumAmountCents(lineItems),
        currency: policy.currency,
      })
      .select("id")
      .single();

    if (error?.code === "23505") {
      // The live-invoice unique index says this family+period was drafted by a
      // concurrent run between the gate above and this insert. That is the
      // outcome we wanted, not an error: skip it and carry on.
      continue;
    }
    if (error || !invoice) {
      return {
        created,
        skippedAlreadyInvoiced,
        creditsUsed: newRedemptions.size,
        error: error?.message ?? "Failed to create invoice",
      };
    }

    const rows = lineItems.map((item, idx) => ({
      invoice_id: invoice.id,
      lesson_id: item.lessonId,
      kind: item.kind,
      description: item.description,
      quantity: item.quantity,
      unit_cents: item.unitCents,
      amount_cents: item.amountCents,
      sort_order: idx,
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(rows);
    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return {
        created,
        skippedAlreadyInvoiced,
        creditsUsed: newRedemptions.size,
        error: itemsError.message,
      };
    }
    created.push(invoice.id);
  }

  return {
    created,
    skippedAlreadyInvoiced,
    creditsUsed: newRedemptions.size,
  };
}

export interface PreviewPeriodResult {
  drafts: (DraftInvoiceSummary & {
    periodStart: string;
    periodEnd: string;
    currency: string;
    items: InvoiceItemDraft[];
  })[];
  totalCents: number;
  skippedAlreadyInvoiced: number;
  creditsToUse: number;
}

export async function previewPeriodDrafts(
  supabase: SupabaseClient,
  teacherId: string,
  periodStart: string,
  periodEnd: string,
  policy: StudioPolicy
): Promise<PreviewPeriodResult> {
  const result = await deriveForPeriod(supabase, teacherId, periodStart, periodEnd, policy);
  const groups = groupItemsByGuardian(result.items);
  const guardianIds = [...groups.keys()];

  const { data: guardians } = guardianIds.length
    ? await supabase
        .from("guardians")
        .select("id, name, family_name")
        .eq("teacher_id", teacherId)
        .in("id", guardianIds)
    : { data: [] };

  const nameById = new Map(
    (guardians ?? []).map((g) => [g.id as string, (g.family_name?.trim() || g.name) as string])
  );

  const drafts = guardianIds.map((guardianId) => {
    const items = groups.get(guardianId)!;
    return {
      guardianId,
      familyName: nameById.get(guardianId) ?? "Family",
      periodStart,
      periodEnd,
      currency: policy.currency,
      subtotalCents: sumAmountCents(items),
      missingRateCount: items.filter((i) => i.missingRate).length,
      creditedLessonCount: result.creditedByGuardian.get(guardianId) ?? 0,
      items,
    };
  });

  return {
    drafts,
    totalCents: drafts.reduce((sum, d) => sum + d.subtotalCents, 0),
    skippedAlreadyInvoiced: result.skippedAlreadyInvoiced,
    creditsToUse: result.newRedemptions.size,
  };
}
