import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import {
  derivePeriodItems,
  getInvoicedLessonIds,
} from "@/lib/server/billing";
import { loadCreditInputs, recordRedemptions } from "@/lib/server/credits";
import {
  groupItemsByGuardian,
  sumAmountCents,
} from "@/lib/billing";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Preview or create draft invoices for a period.
 * Body: { periodStart, periodEnd, commit?: boolean }
 *
 * Lessons already on a draft/sent/paid invoice are skipped (no double-billing).
 * Voided invoices free their lessons for a new generate.
 * Billable lessons a prepaid package covers use a credit instead of a line;
 * on commit those credits are recorded even for families with no invoice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const periodStart = String(body.periodStart ?? "");
  const periodEnd = String(body.periodEnd ?? "");
  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
    return NextResponse.json(
      { error: "Choose a start and end date" },
      { status: 400 }
    );
  }
  if (periodEnd < periodStart) {
    return NextResponse.json(
      { error: "End date must be on or after the start date" },
      { status: 400 }
    );
  }

  const policy = await getPolicy(supabase, user.id);
  let result;
  try {
    const [excludeLessonIds, travelInvoicedLessonIds, credits] =
      await Promise.all([
        getInvoicedLessonIds(supabase, user.id),
        getInvoicedLessonIds(supabase, user.id, { kind: "travel" }),
        loadCreditInputs(supabase, user.id),
      ]);
    result = await derivePeriodItems(
      supabase,
      user.id,
      periodStart,
      periodEnd,
      policy,
      { excludeLessonIds, travelInvoicedLessonIds, credits }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { items, skippedAlreadyInvoiced, newRedemptions, creditedByGuardian } =
    result;
  const groups = groupItemsByGuardian(items);
  const guardianIds = [...groups.keys()];

  const { data: guardians } = guardianIds.length
    ? await supabase
        .from("guardians")
        .select("id, name, family_name")
        .eq("teacher_id", user.id)
        .in("id", guardianIds)
    : { data: [] };

  const nameById = new Map(
    (guardians ?? []).map((g) => [
      g.id,
      (g.family_name?.trim() || g.name) as string,
    ])
  );

  const drafts = guardianIds.map((guardianId) => {
    const lineItems = groups.get(guardianId)!;
    return {
      guardianId,
      familyName: nameById.get(guardianId) ?? "Family",
      periodStart,
      periodEnd,
      currency: policy.currency,
      subtotalCents: sumAmountCents(lineItems),
      missingRateCount: lineItems.filter((i) => i.missingRate).length,
      creditedLessonCount: creditedByGuardian.get(guardianId) ?? 0,
      items: lineItems,
    };
  });

  if (!body.commit) {
    return NextResponse.json({
      periodStart,
      periodEnd,
      drafts,
      totalFamilies: drafts.length,
      totalCents: drafts.reduce((s, d) => s + d.subtotalCents, 0),
      skippedAlreadyInvoiced,
      creditsToUse: newRedemptions.size,
    });
  }

  // Record credits before writing lesson lines: the database refuses a
  // redemption for a lesson that is already invoiced, and vice versa.
  const redemptionError = await recordRedemptions(
    supabase,
    user.id,
    newRedemptions
  );
  if (redemptionError) {
    return NextResponse.json({ error: redemptionError }, { status: 500 });
  }

  if (drafts.length === 0 && newRedemptions.size > 0) {
    return NextResponse.json({
      created: [],
      count: 0,
      skippedAlreadyInvoiced,
      creditsUsed: newRedemptions.size,
    });
  }

  if (drafts.length === 0) {
    return NextResponse.json(
      {
        error:
          skippedAlreadyInvoiced > 0
            ? "All billable lessons in this period are already on another invoice"
            : "No billable lessons in this period",
      },
      { status: 400 }
    );
  }

  const created: string[] = [];
  for (const draft of drafts) {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        teacher_id: user.id,
        guardian_id: draft.guardianId,
        period_start: periodStart,
        period_end: periodEnd,
        status: "draft",
        subtotal_cents: draft.subtotalCents,
        currency: policy.currency,
      })
      .select("id")
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create invoice" },
        { status: 500 }
      );
    }

    const rows = draft.items.map((item, idx) => ({
      invoice_id: invoice.id,
      lesson_id: item.lessonId,
      kind: item.kind,
      description: item.description,
      quantity: item.quantity,
      unit_cents: item.unitCents,
      amount_cents: item.amountCents,
      sort_order: idx,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(rows);

    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
    created.push(invoice.id);
  }

  return NextResponse.json({
    created,
    count: created.length,
    skippedAlreadyInvoiced,
    creditsUsed: newRedemptions.size,
  });
}
