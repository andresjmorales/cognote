import type { SupabaseClient } from "@supabase/supabase-js";
import { isBillable } from "@/lib/billing";
import {
  allocateCredits,
  summarizeCreditBalances,
  type CreditCandidate,
  type CreditPackageBalance,
  type CreditPackageInput,
} from "@/lib/credits";
import type { StudioPolicy } from "@/lib/schedule";
import { oneToOne } from "@/lib/schedule";
import type { AttendanceStatus, InvoiceStatus } from "@/lib/supabase/types";
import { getInvoicedLessonIds } from "@/lib/server/billing";

export interface CreditPackageRecord extends CreditPackageInput {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  priceCents: number;
  createdAt: string;
  redemptions: { id: string; lessonId: string; lessonDate: string | null }[];
}

export interface CreditPackageWithBalance extends CreditPackageRecord {
  balance: CreditPackageBalance;
}

interface PackageRow {
  id: string;
  student_id: string;
  invoice_id: string;
  credits: number;
  duration_minutes: number;
  price_cents: number;
  starts_on: string;
  expires_on: string | null;
  created_at: string;
  invoices: { status: InvoiceStatus } | { status: InvoiceStatus }[] | null;
  credit_redemptions:
    | {
        id: string;
        lesson_id: string;
        lessons:
          | { lesson_date: string }
          | { lesson_date: string }[]
          | null;
      }[]
    | null;
}

/** Credits can be used once the purchase invoice is sent or paid. */
export function packageInvoiceIsActive(status: InvoiceStatus): boolean {
  return status === "sent" || status === "paid";
}

/**
 * Packages for this teacher, newest first, optionally for some students.
 * Works with the RLS client or the service client (portal).
 */
export async function loadCreditPackages(
  supabase: SupabaseClient,
  teacherId: string,
  opts: { studentIds?: string[] } = {}
): Promise<CreditPackageRecord[]> {
  if (opts.studentIds && opts.studentIds.length === 0) return [];

  let query = supabase
    .from("credit_packages")
    .select(
      `
      id, student_id, invoice_id, credits, duration_minutes, price_cents,
      starts_on, expires_on, created_at,
      invoices ( status ),
      credit_redemptions ( id, lesson_id, lessons ( lesson_date ) )
    `
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (opts.studentIds) query = query.in("student_id", opts.studentIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as PackageRow[]).map((row) => {
    const invoiceStatus = oneToOne(row.invoices)?.status ?? "void";
    const redemptions = (row.credit_redemptions ?? [])
      .map((r) => ({
        id: r.id,
        lessonId: r.lesson_id,
        lessonDate: oneToOne(r.lessons)?.lesson_date ?? null,
      }))
      .sort((a, b) => (a.lessonDate ?? "").localeCompare(b.lessonDate ?? ""));
    return {
      id: row.id,
      studentId: row.student_id,
      durationMinutes: row.duration_minutes,
      credits: row.credits,
      usedCredits: redemptions.length,
      startsOn: row.starts_on,
      expiresOn: row.expires_on,
      active: packageInvoiceIsActive(invoiceStatus),
      invoiceId: row.invoice_id,
      invoiceStatus,
      priceCents: row.price_cents,
      createdAt: row.created_at,
      redemptions,
    };
  });
}

/** Lesson IDs already paid by a credit, for this teacher. */
export async function getRedeemedLessonIds(
  supabase: SupabaseClient,
  teacherId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("credit_redemptions")
    .select("lesson_id")
    .eq("teacher_id", teacherId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

/** Everything derivePeriodItems needs to apply credits. */
export async function loadCreditInputs(
  supabase: SupabaseClient,
  teacherId: string
): Promise<{ packages: CreditPackageInput[]; redeemedLessonIds: Set<string> }> {
  const [packages, redeemedLessonIds] = await Promise.all([
    loadCreditPackages(supabase, teacherId),
    getRedeemedLessonIds(supabase, teacherId),
  ]);
  return { packages, redeemedLessonIds };
}

/**
 * Write new redemptions in one statement, so either all of them land or
 * none do. The database re-checks every rule (credits left, dates, length,
 * not invoiced).
 */
export async function recordRedemptions(
  supabase: SupabaseClient,
  teacherId: string,
  allocation: Map<string, string>
): Promise<string | null> {
  if (allocation.size === 0) return null;
  const { error } = await supabase.from("credit_redemptions").insert(
    [...allocation].map(([lessonId, packageId]) => ({
      teacher_id: teacherId,
      lesson_id: lessonId,
      package_id: packageId,
    }))
  );
  return error ? error.message : null;
}

interface PendingLessonRow {
  id: string;
  student_id: string;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
  makeup_for: string | null;
  students:
    | { guardian_id: string | null }
    | { guardian_id: string | null }[]
    | null;
  attendance:
    | { status: AttendanceStatus; notice_at: string | null }[]
    | { status: AttendanceStatus; notice_at: string | null }
    | null;
}

/**
 * Packages with live balances. Marked, billable lessons that the next
 * invoice run will cover count as used already, so "credits left" doesn't
 * lag behind attendance.
 */
export async function loadCreditBalances(
  supabase: SupabaseClient,
  teacherId: string,
  policy: StudioPolicy,
  studentIds: string[],
  today: string
): Promise<CreditPackageWithBalance[]> {
  // A void package invoice means the sale didn't happen; nothing to show.
  const packages = (
    await loadCreditPackages(supabase, teacherId, { studentIds })
  ).filter((p) => p.invoiceStatus !== "void");
  if (packages.length === 0) return [];

  const usable = packages.filter((p) => p.active);
  let pending = new Map<string, string>();
  if (usable.length > 0) {
    const earliest = usable.reduce(
      (min, p) => (p.startsOn < min ? p.startsOn : min),
      usable[0].startsOn
    );
    const [lessonsRes, redeemed, invoiced] = await Promise.all([
      supabase
        .from("lessons")
        .select(
          `
          id, student_id, lesson_date, starts_at, duration_minutes, makeup_for,
          students ( guardian_id ),
          attendance!lesson_id ( status, notice_at )
        `
        )
        .eq("teacher_id", teacherId)
        .in("student_id", [...new Set(usable.map((p) => p.studentId))])
        .gte("lesson_date", earliest),
      getRedeemedLessonIds(supabase, teacherId),
      getInvoicedLessonIds(supabase, teacherId),
    ]);
    if (lessonsRes.error) throw new Error(lessonsRes.error.message);

    const candidates: CreditCandidate[] = [];
    for (const row of (lessonsRes.data ?? []) as PendingLessonRow[]) {
      const attendance = oneToOne(row.attendance);
      if (!attendance) continue;
      if (!oneToOne(row.students)?.guardian_id) continue;
      if (redeemed.has(row.id) || invoiced.has(row.id)) continue;
      const billable = isBillable(
        {
          attendanceStatus: attendance.status,
          noticeAt: attendance.notice_at,
          startsAt: row.starts_at,
          makeupFor: row.makeup_for,
        },
        policy
      );
      if (!billable) continue;
      candidates.push({
        lessonId: row.id,
        studentId: row.student_id,
        lessonDate: row.lesson_date,
        startsAt: row.starts_at,
        durationMinutes: row.duration_minutes,
      });
    }
    pending = allocateCredits(candidates, usable);
  }

  const balances = summarizeCreditBalances(packages, pending, today);
  return packages.map((pkg, i) => ({ ...pkg, balance: balances[i] }));
}
