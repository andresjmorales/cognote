import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toLocalDateString } from "@/lib/schedule";
import { defaultInvoicePeriod, shouldDraftInvoicesOn } from "@/lib/billing";
import { createDraftInvoices } from "@/lib/server/billing";
import { createTeacherNotification } from "@/lib/server/notifications";
import { getPolicy } from "@/lib/server/scheduling";
import { cronOrigin, authorizeCron } from "@/lib/server/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily job: for studios that opted in to auto-drafts, create DRAFT invoices
 * for the previous full calendar month. Never sends — the teacher reviews and
 * sends. Safe to run repeatedly: already-invoiced lessons are excluded by the
 * double-billing gate, so a second run creates nothing.
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const origin = cronOrigin(req);

  // Only the ids: the policy itself is read per teacher through getPolicy(),
  // which decrypts the BYO secrets. Spreading the raw row here would leave
  // encrypted blobs on the object and invite a later reader to use them.
  const { data: policyRows, error } = await supabase
    .from("studio_policies")
    .select("teacher_id")
    .eq("auto_draft_invoices", true);

  if (error) {
    console.error("invoice-drafts load:", error);
    return NextResponse.json({ error: "Failed to load policies" }, { status: 500 });
  }

  const errors: { teacherId: string; message: string }[] = [];
  let processed = 0;
  let createdTotal = 0;
  let skippedNoLessons = 0;

  for (const row of policyRows ?? []) {
    const teacherId = row.teacher_id as string;

    try {
      const policy = await getPolicy(supabase, teacherId);

      // Inside the try: an invalid `timezone` row makes toLocalDateString throw
      // a RangeError, and one studio's bad setting must not abandon the sweep.
      const todayLocal = toLocalDateString(now, policy.timezone);
      if (!shouldDraftInvoicesOn(todayLocal)) continue;

      const { start, end } = defaultInvoicePeriod(todayLocal, "monthly");
      processed += 1;

      const result = await createDraftInvoices(supabase, teacherId, start, end, policy, {
        // Cron only: a family already invoiced for this exact period is skipped
        // even if that invoice was voided. The teacher's own commit route does
        // not pass this, so voiding and regenerating by hand still works.
        skipAlreadyDrafted: true,
      });
      if (result.error) {
        errors.push({ teacherId, message: result.error });
        continue;
      }
      createdTotal += result.created.length;

      if (result.created.length === 0) {
        skippedNoLessons += 1;
        continue;
      }

      const count = result.created.length;
      await createTeacherNotification(supabase, {
        teacherId,
        type: "invoice_drafts_ready",
        title: `${count} invoice${count === 1 ? "" : "s"} ready to review`,
        body: `Drafts for ${start} to ${end}. Review and send when you are happy with them.`,
        href: "/billing",
        origin,
        policy,
      });
    } catch (err) {
      errors.push({
        teacherId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    processed,
    created: createdTotal,
    skippedNoLessons,
    errors,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
