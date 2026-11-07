import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Remove a manual payment recorded by mistake. If the invoice was paid and
 * is now underpaid, the database reopens it in the same statement: to sent
 * if the family was sent it, otherwise back to draft (out of the portal).
 * Stripe payments and payments on void invoices are refused here and by the
 * payments_rules trigger.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id, paymentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, sent_at")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { error: "Payments on a void invoice cannot be removed" },
      { status: 400 }
    );
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, method")
    .eq("id", paymentId)
    .eq("invoice_id", id)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (payment.method !== "manual") {
    return NextResponse.json(
      {
        error:
          "Stripe payments can't be removed here. Refund it in your Stripe dashboard.",
      },
      { status: 400 }
    );
  }

  // A paid, never-sent invoice reopens to draft, but prepaid credits can only
  // be used while their invoice is sent or paid. The database refuses this
  // too; checking here gives a clear message.
  if (invoice.status === "paid" && !invoice.sent_at) {
    const { data: creditPackage } = await supabase
      .from("credit_packages")
      .select("id, credit_redemptions ( id )")
      .eq("invoice_id", id)
      .maybeSingle();
    if ((creditPackage?.credit_redemptions as unknown[] | null)?.length) {
      return NextResponse.json(
        {
          error:
            "Some of these prepaid credits are already used. Return them from the student's page before removing this payment.",
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("invoice_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  return NextResponse.json({ ok: true, status: updated?.status ?? null });
}
