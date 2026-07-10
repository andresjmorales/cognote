import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { constructWebhookEvent } from "@/lib/payments";

/**
 * Stripe webhook per teacher (BYO keys).
 * URL: /api/webhooks/stripe/<teacherId>
 * Event: checkout.session.completed → mark invoice paid + insert payment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const { teacherId } = await params;
  const supabase = createServiceClient();
  const policy = await getPolicy(supabase, teacherId);

  if (!policy.stripe_secret_key || !policy.stripe_webhook_secret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured for this teacher" },
      { status: 400 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event;
  try {
    event = constructWebhookEvent(
      rawBody,
      signature,
      policy.stripe_webhook_secret,
      policy.stripe_secret_key
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe webhook verify failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;
    const metaTeacher = session.metadata?.teacher_id;

    if (!invoiceId || metaTeacher !== teacherId) {
      console.error("Stripe webhook: missing or mismatched metadata", {
        invoiceId,
        metaTeacher,
        teacherId,
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status, subtotal_cents, teacher_id")
      .eq("id", invoiceId)
      .eq("teacher_id", teacherId)
      .single();

    if (!invoice) {
      return NextResponse.json({ received: true, skipped: true });
    }

    if (invoice.status !== "paid") {
      const amount =
        typeof session.amount_total === "number"
          ? session.amount_total
          : invoice.subtotal_cents;

      await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount_cents: amount,
        method: "stripe",
        external_id: session.payment_intent
          ? String(session.payment_intent)
          : session.id,
        note: "Stripe Checkout",
      });

      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: "stripe",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent
            ? String(session.payment_intent)
            : null,
          stripe_checkout_url: session.url ?? null,
        })
        .eq("id", invoiceId)
        .eq("teacher_id", teacherId);
    }
  }

  return NextResponse.json({ received: true });
}
