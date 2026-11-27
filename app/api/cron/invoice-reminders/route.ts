import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { StudioPolicy } from "@/lib/schedule";
import { daysOverdue } from "@/lib/billing";
import { sendInvoiceReminder } from "@/lib/server/invoice-reminder";
import { getPolicy } from "@/lib/server/scheduling";
import { authorizeCron, cronOrigin } from "@/lib/server/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Newest candidates processed per run; the response says when it was cut. */
const CANDIDATE_LIMIT = 200;

/**
 * Daily job: email the single reminder for invoices still unpaid past the
 * studio's payment terms. Each invoice is reminded at most once
 * (invoices.reminder_sent_at).
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const origin = cronOrigin(req);

  const { data: candidates, error } = await supabase
    .from("invoices")
    .select("id, teacher_id, sent_at, subtotal_cents, payments ( amount_cents )")
    .eq("status", "sent")
    .is("reminder_sent_at", null)
    .not("sent_at", "is", null)
    .order("sent_at")
    .limit(CANDIDATE_LIMIT);

  if (error) {
    console.error("invoice-reminders load:", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }

  // Read each studio's policy through getPolicy(): it decrypts the BYO secrets
  // and merges defaults, so the route never handles the raw row's ciphertext.
  // One read per teacher per run.
  const policyByTeacher = new Map<string, StudioPolicy>();

  let sent = 0;
  let skipped = 0;
  const failures: { invoiceId: string; reason: string }[] = [];

  for (const invoice of candidates ?? []) {
    const teacherId = invoice.teacher_id as string;
    const invoiceId = invoice.id as string;

    try {
      let policy = policyByTeacher.get(teacherId);
      if (!policy) {
        policy = await getPolicy(supabase, teacherId);
        policyByTeacher.set(teacherId, policy);
      }

      const lateDays = daysOverdue(
        invoice.sent_at as string,
        policy.payment_terms_days,
        now
      );
      // Reminders only apply to invoices sent at/after the studio enabled
      // them. null enabled_at means reminders are off entirely.
      if (
        policy.invoice_reminders_enabled_at &&
        new Date(invoice.sent_at as string) <
          new Date(policy.invoice_reminders_enabled_at)
      ) {
        skipped += 1;
        continue;
      }
      if (!Number.isFinite(lateDays) || lateDays < 1) {
        skipped += 1;
        continue;
      }

      const result = await sendInvoiceReminder(supabase, {
        invoiceId,
        teacherId,
        origin,
        now,
      });
      if (result.status === "sent") sent += 1;
      else {
        skipped += 1;
        if (result.status === "failed") {
          failures.push({ invoiceId, reason: result.reason ?? "failed" });
        }
      }
    } catch (err) {
      failures.push({
        invoiceId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const candidateCount = candidates?.length ?? 0;
  return NextResponse.json({
    candidates: candidateCount,
    // A full page means there may be more waiting: observable, not silent.
    truncated: candidateCount >= CANDIDATE_LIMIT,
    sent,
    skipped,
    failures,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
