import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import {
  derivePeriodItems,
  getInvoicedLessonIds,
} from "@/lib/server/billing";
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
      { error: "periodStart and periodEnd (YYYY-MM-DD) are required" },
      { status: 400 }
    );
  }
  if (periodEnd < periodStart) {
    return NextResponse.json(
      { error: "periodEnd must be on or after periodStart" },
      { status: 400 }
    );
  }

  const policy = await getPolicy(supabase, user.id);
  let items;
  let skippedAlreadyInvoiced = 0;
  try {
    const excludeLessonIds = await getInvoicedLessonIds(supabase, user.id);
    const result = await derivePeriodItems(
      supabase,
      user.id,
      periodStart,
      periodEnd,
      policy,
      { excludeLessonIds }
    );
    items = result.items;
    skippedAlreadyInvoiced = result.skippedAlreadyInvoiced;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

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
  });
}
