import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { expireCheckoutSession } from "@/lib/payments";
import { resolveManualPaymentAmount, summarizePayments } from "@/lib/billing";

/**
 * Record a manual payment. Body: { amountCents?, note? }. Without an amount
 * this pays the remaining balance (the original one-click "Mark paid").
 * The invoice flips to paid only once its payments cover the subtotal.
 */
export async function POST(
  req: NextRequest,
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
    .select(
      "id, status, subtotal_cents, stripe_checkout_session_id, payments ( amount_cents )"
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { error: "Cannot record a payment on a void invoice" },
      { status: 400 }
    );
  }

  const existing = (
    (invoice.payments as { amount_cents: number }[] | null) ?? []
  ).map((p) => ({ amountCents: p.amount_cents }));
  const before = summarizePayments(invoice.subtotal_cents, existing);

  if (invoice.status === "paid" && before.settled) {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  const requested =
    body.amountCents === undefined || body.amountCents === null
      ? null
      : Number(body.amountCents);

  // Draft totals can still change, so only a full payment is allowed there.
  if (invoice.status === "draft" && requested !== null) {
    return NextResponse.json(
      { error: "Send the invoice before recording a partial payment" },
      { status: 400 }
    );
  }

  const amount = resolveManualPaymentAmount(requested, before.balanceCents);
  if (!amount.ok) {
    return NextResponse.json({ error: amount.error }, { status: 400 });
  }

  const { error: payError } = await supabase.from("payments").insert({
    invoice_id: id,
    amount_cents: amount.amountCents,
    method: "manual",
    note,
  });

  if (payError) {
    return NextResponse.json({ error: payError.message }, { status: 500 });
  }

  const after = summarizePayments(invoice.subtotal_cents, [
    ...existing,
    { amountCents: amount.amountCents },
  ]);

  // A pay link was made for the old balance; retire it so the family can't
  // pay the wrong amount. The teacher can create a fresh link for the rest.
  let checkoutCleared = false;
  if (invoice.stripe_checkout_session_id) {
    const policy = await getPolicy(supabase, user.id);
    if (policy.stripe_secret_key) {
      try {
        await expireCheckoutSession(
          policy.stripe_secret_key,
          invoice.stripe_checkout_session_id
        );
      } catch (err) {
        console.error(
          "Expire Stripe checkout after manual payment failed:",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    checkoutCleared = true;
  }

  if (after.settled || checkoutCleared) {
    const { error } = await supabase
      .from("invoices")
      .update({
        ...(after.settled && {
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: "manual",
        }),
        ...(checkoutCleared && {
          stripe_checkout_session_id: null,
          stripe_checkout_url: null,
        }),
      })
      .eq("id", id)
      .eq("teacher_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    paid: after.settled,
    balanceCents: after.balanceCents,
  });
}
