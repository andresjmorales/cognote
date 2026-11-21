import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { createDraftInvoices, previewPeriodDrafts } from "@/lib/server/billing";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Preview or create draft invoices for a period.
 * Body: { periodStart, periodEnd, commit?: boolean }
 *
 * Lessons already on a draft/sent/paid invoice are skipped (no double-billing).
 * Voided invoices free their lessons for a new generate. Billable lessons a
 * prepaid package covers use a credit instead of a line; on commit those
 * credits are recorded even for families with no invoice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const periodStart = String(body.periodStart ?? "");
  const periodEnd = String(body.periodEnd ?? "");
  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
    return NextResponse.json({ error: "Choose a start and end date" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json(
      { error: "End date must be on or after the start date" },
      { status: 400 }
    );
  }

  const policy = await getPolicy(supabase, user.id);

  try {
    if (!body.commit) {
      const preview = await previewPeriodDrafts(
        supabase, user.id, periodStart, periodEnd, policy
      );
      return NextResponse.json({
        periodStart,
        periodEnd,
        drafts: preview.drafts,
        totalFamilies: preview.drafts.length,
        totalCents: preview.totalCents,
        skippedAlreadyInvoiced: preview.skippedAlreadyInvoiced,
        creditsToUse: preview.creditsToUse,
      });
    }

    const result = await createDraftInvoices(
      supabase, user.id, periodStart, periodEnd, policy
    );
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    if (result.created.length === 0 && result.creditsUsed > 0) {
      return NextResponse.json({
        created: [],
        count: 0,
        skippedAlreadyInvoiced: result.skippedAlreadyInvoiced,
        creditsUsed: result.creditsUsed,
      });
    }
    if (result.created.length === 0) {
      return NextResponse.json(
        {
          error:
            result.skippedAlreadyInvoiced > 0
              ? "All billable lessons in this period are already on another invoice"
              : "No billable lessons in this period",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      created: result.created,
      count: result.created.length,
      skippedAlreadyInvoiced: result.skippedAlreadyInvoiced,
      creditsUsed: result.creditsUsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
