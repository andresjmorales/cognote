import type { AttendanceStatus } from "@/lib/supabase/types";
import type { StudioPolicy } from "@/lib/schedule";

/**
 * Billing derivation.
 *
 * Attendance → invoice items is a pure function of (attendance, policy, rates).
 * Policy is an input, never baked into attendance rows. Make-up lessons that
 * redeem a credit (makeup_for set) are non-billable by default so the
 * original cancellation and the make-up never both bill.
 */

export interface RateSources {
  slotRateCents: number | null;
  studentDefaultRateCents: number | null;
  studioDefaultRateCents: number | null;
  /** Flat studio rate for this lesson's duration, if configured. */
  durationRateCents?: number | null;
}

export interface TravelFeeSources {
  studentTravelFeeCents: number | null;
  studioTravelFeeCents: number | null;
}

export interface BillableLessonInput {
  lessonId: string;
  studentId: string;
  studentName: string;
  guardianId: string | null;
  lessonDate: string;
  startsAt: string;
  durationMinutes: number;
  makeupFor: string | null;
  attendanceStatus: AttendanceStatus;
  noticeAt: string | null;
  rate: RateSources;
  isHomeVisit?: boolean;
  travel?: TravelFeeSources;
}

export interface InvoiceItemDraft {
  lessonId: string;
  studentId: string;
  guardianId: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  /** True when the lesson is billable but no rate was configured. */
  missingRate: boolean;
}

/** Slot → student → studio. Returns null when nothing is set. */
export function resolveLessonRate(sources: RateSources): number | null {
  if (sources.slotRateCents != null && sources.slotRateCents >= 0) {
    return sources.slotRateCents;
  }
  if (
    sources.studentDefaultRateCents != null &&
    sources.studentDefaultRateCents >= 0
  ) {
    return sources.studentDefaultRateCents;
  }
  if (
    sources.studioDefaultRateCents != null &&
    sources.studioDefaultRateCents >= 0
  ) {
    return sources.studioDefaultRateCents;
  }
  return null;
}

/**
 * Student override → studio default. Returns null when nothing is set.
 * Zero is a valid “no fee” override.
 */
export function resolveTravelFeeCents(
  sources: TravelFeeSources
): number | null {
  if (
    sources.studentTravelFeeCents != null &&
    sources.studentTravelFeeCents >= 0
  ) {
    return sources.studentTravelFeeCents;
  }
  if (
    sources.studioTravelFeeCents != null &&
    sources.studioTravelFeeCents >= 0
  ) {
    return sources.studioTravelFeeCents;
  }
  return null;
}

export type ResolvedLessonCharge = {
  amountCents: number;
  missingRate: boolean;
  /** True when the charge came from a duration flat map (not hourly). */
  usedDurationFlat: boolean;
  /** Configured rate used for the /hr note when applicable. */
  unitRateCents: number | null;
};

/**
 * Slot → student → duration flat map → studio.
 * Slot/student/studio amounts use rate_basis; duration map amounts are always
 * flat for that length (studio packaging when no more-specific rate is set).
 */
export function resolveLessonCharge(
  sources: RateSources,
  durationMinutes: number,
  rateBasis: StudioPolicy["rate_basis"]
): ResolvedLessonCharge {
  if (sources.slotRateCents != null && sources.slotRateCents >= 0) {
    return {
      amountCents: lessonAmountCents(
        sources.slotRateCents,
        durationMinutes,
        rateBasis
      ),
      missingRate: false,
      usedDurationFlat: false,
      unitRateCents: sources.slotRateCents,
    };
  }
  if (
    sources.studentDefaultRateCents != null &&
    sources.studentDefaultRateCents >= 0
  ) {
    return {
      amountCents: lessonAmountCents(
        sources.studentDefaultRateCents,
        durationMinutes,
        rateBasis
      ),
      missingRate: false,
      usedDurationFlat: false,
      unitRateCents: sources.studentDefaultRateCents,
    };
  }
  if (sources.durationRateCents != null && sources.durationRateCents >= 0) {
    return {
      amountCents: sources.durationRateCents,
      missingRate: false,
      usedDurationFlat: true,
      unitRateCents: sources.durationRateCents,
    };
  }
  if (
    sources.studioDefaultRateCents != null &&
    sources.studioDefaultRateCents >= 0
  ) {
    return {
      amountCents: lessonAmountCents(
        sources.studioDefaultRateCents,
        durationMinutes,
        rateBasis
      ),
      missingRate: false,
      usedDurationFlat: false,
      unitRateCents: sources.studioDefaultRateCents,
    };
  }
  return {
    amountCents: 0,
    missingRate: true,
    usedDurationFlat: false,
    unitRateCents: null,
  };
}

/**
 * Whether a marked lesson should appear on an invoice under the given policy.
 * Unmarked lessons are never billable (caller should only pass marked ones).
 */
export function isBillable(
  lesson: Pick<
    BillableLessonInput,
    "attendanceStatus" | "noticeAt" | "startsAt" | "makeupFor"
  >,
  policy: StudioPolicy
): boolean {
  if (lesson.makeupFor && !policy.bill_makeup) {
    return false;
  }

  switch (lesson.attendanceStatus) {
    case "attended":
      return policy.bill_attended;
    case "no_show":
      return policy.bill_no_show;
    case "teacher_cancel":
      return policy.bill_teacher_cancel;
    case "student_cancel": {
      const windowMs = policy.cancellation_window_hours * 60 * 60 * 1000;
      const notice = lesson.noticeAt
        ? new Date(lesson.noticeAt).getTime()
        : Date.now();
      const timely = new Date(lesson.startsAt).getTime() - notice >= windowMs;
      return timely
        ? policy.bill_timely_student_cancel
        : policy.bill_late_student_cancel;
    }
  }
}

function statusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "attended":
      return "Lesson";
    case "no_show":
      return "No-show";
    case "teacher_cancel":
      return "Teacher cancellation";
    case "student_cancel":
      return "Student cancellation";
  }
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Charge for one lesson given a resolved rate and the studio's rate basis.
 * per_lesson: rate is the full lesson price.
 * per_hour: rate × (durationMinutes / 60), rounded to nearest cent.
 */
export function lessonAmountCents(
  rateCents: number,
  durationMinutes: number,
  rateBasis: StudioPolicy["rate_basis"]
): number {
  if (rateBasis === "per_hour") {
    return Math.round((rateCents * durationMinutes) / 60);
  }
  return rateCents;
}

/**
 * Derive draft invoice line items for a set of marked lessons.
 * Lessons without a guardian are skipped (nothing to invoice).
 * Billable lessons with no rate still produce a $0 line with missingRate.
 * Home visits may add a separate travel-fee line when a fee is configured.
 */
export function deriveInvoiceItems(
  lessons: BillableLessonInput[],
  policy: StudioPolicy
): InvoiceItemDraft[] {
  const items: InvoiceItemDraft[] = [];

  for (const lesson of lessons) {
    if (!lesson.guardianId) continue;
    if (!isBillable(lesson, policy)) continue;

    const durationFlat =
      lesson.rate.durationRateCents ??
      policy.duration_rate_cents[lesson.durationMinutes] ??
      null;
    const charge = resolveLessonCharge(
      { ...lesson.rate, durationRateCents: durationFlat },
      lesson.durationMinutes,
      policy.rate_basis
    );
    const when = formatShortDate(lesson.lessonDate);
    const label = statusLabel(lesson.attendanceStatus);
    const makeup = lesson.makeupFor ? " (make-up)" : "";
    const rateNote =
      !charge.missingRate &&
      !charge.usedDurationFlat &&
      policy.rate_basis === "per_hour" &&
      charge.unitRateCents != null
        ? ` @ ${formatMoney(charge.unitRateCents, policy.currency)}/hr`
        : "";

    items.push({
      lessonId: lesson.lessonId,
      studentId: lesson.studentId,
      guardianId: lesson.guardianId,
      description: `${label}${makeup} - ${lesson.studentName}, ${when} (${lesson.durationMinutes} min${rateNote})`,
      quantity: 1,
      unitCents: charge.amountCents,
      amountCents: charge.amountCents,
      missingRate: charge.missingRate,
    });

    if (lesson.isHomeVisit && lesson.travel) {
      const travelFee = resolveTravelFeeCents(lesson.travel);
      if (travelFee != null && travelFee > 0) {
        items.push({
          lessonId: lesson.lessonId,
          studentId: lesson.studentId,
          guardianId: lesson.guardianId,
          description: `Travel fee - ${lesson.studentName}, ${when}`,
          quantity: 1,
          unitCents: travelFee,
          amountCents: travelFee,
          missingRate: false,
        });
      }
    }
  }

  return items;
}

/** Group draft items by guardian for one invoice per family. */
export function groupItemsByGuardian(
  items: InvoiceItemDraft[]
): Map<string, InvoiceItemDraft[]> {
  const map = new Map<string, InvoiceItemDraft[]>();
  for (const item of items) {
    const list = map.get(item.guardianId) ?? [];
    list.push(item);
    map.set(item.guardianId, list);
  }
  return map;
}

export function sumAmountCents(items: { amountCents: number }[]): number {
  return items.reduce((sum, i) => sum + i.amountCents, 0);
}

/** e.g. formatMoney(4500, "USD") → "$45.00" */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Parse a dollars string like "45" or "45.00" into cents. */
export function dollarsToCents(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }
  const trimmed = value.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

/**
 * Default date range pre-filled in Generate invoices.
 * monthly → previous full calendar month (typical “bill last month” workflow).
 * manual → 1st of current month through today (handy for mid-month / testing).
 * Teacher can always edit the dates before previewing.
 */
export function defaultInvoicePeriod(
  todayLocal: string, // YYYY-MM-DD
  cadence: "monthly" | "manual"
): { start: string; end: string } {
  const [y, m, d] = todayLocal.split("-").map(Number);
  if (cadence === "manual") {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    return { start, end: todayLocal };
  }
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  void d;
  return { start, end };
}

/** Mask a secret for display: sk_live_…abcd */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

/**
 * Reject Stripe test/sandbox keys so teachers don't accidentally collect
 * real payments against a test account. Empty/null is allowed (not configured).
 * Returns an error message, or null when ok.
 */
export function validateLiveStripeKeys(opts: {
  secretKey?: string | null;
  publishableKey?: string | null;
}): string | null {
  const secret = opts.secretKey?.trim() || null;
  const publishable = opts.publishableKey?.trim() || null;

  if (secret) {
    if (secret.startsWith("sk_test_")) {
      return "Test/sandbox Stripe secret keys are not accepted. Paste a live Standard secret key (sk_live_…).";
    }
    if (secret.startsWith("rk_")) {
      return "Restricted keys (rk_…) are not used for studio tuition. Paste your Standard secret key (sk_live_…) from Developers → API keys.";
    }
    if (!secret.startsWith("sk_live_")) {
      return "Secret key must be a live Standard key starting with sk_live_.";
    }
  }
  if (publishable) {
    if (publishable.startsWith("pk_test_")) {
      return "Test/sandbox Stripe publishable keys are not accepted. Paste a live publishable key (pk_live_…).";
    }
    if (!publishable.startsWith("pk_live_")) {
      return "Publishable key must be a live Standard key starting with pk_live_.";
    }
  }
  return null;
}

export interface StripeKeyStatus {
  secretConfigured: boolean;
  secretMasked: string | null;
  publishableConfigured: boolean;
  publishableMasked: string | null;
  webhookConfigured: boolean;
  webhookMasked: string | null;
}

/** Build masked Stripe key status from a full policy (safe for client props). */
export function stripeStatusFromPolicy(policy: {
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
}): StripeKeyStatus {
  return {
    secretConfigured: !!policy.stripe_secret_key,
    secretMasked: maskSecret(policy.stripe_secret_key),
    publishableConfigured: !!policy.stripe_publishable_key,
    publishableMasked: maskSecret(policy.stripe_publishable_key),
    webhookConfigured: !!policy.stripe_webhook_secret,
    webhookMasked: maskSecret(policy.stripe_webhook_secret),
  };
}
