import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import {
  derivePeriodItems,
  getInvoicedLessonIds,
} from "@/lib/server/billing";
import { sumAmountCents } from "@/lib/billing";

/**
 * Re-derive line items for a draft invoice from current attendance × policy.
 * Replaces existing items. Lessons already on *other* invoices stay excluded;
 * lessons currently on this draft are included again.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, guardian_id, period_start, period_end, currency")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be regenerated" },
      { status: 400 }
    );
  }

  const policy = await getPolicy(supabase, user.id);

  try {
    const excludeLessonIds = await getInvoicedLessonIds(supabase, user.id, {
      exceptInvoiceId: id,
    });
    const { items } = await derivePeriodItems(
      supabase,
      user.id,
      invoice.period_start,
      invoice.period_end,
      policy,
      {
        guardianId: invoice.guardian_id,
        excludeLessonIds,
      }
    );

    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("invoice_items").insert(
        items.map((item, idx) => ({
          invoice_id: id,
          lesson_id: item.lessonId,
          description: item.description,
          quantity: item.quantity,
          unit_cents: item.unitCents,
          amount_cents: item.amountCents,
          sort_order: idx,
        }))
      );
      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }

    const subtotal = sumAmountCents(items);
    const { error } = await supabase
      .from("invoices")
      .update({ subtotal_cents: subtotal })
      .eq("id", id)
      .eq("teacher_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      itemCount: items.length,
      subtotalCents: subtotal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
