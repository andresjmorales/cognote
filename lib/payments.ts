/**
 * Payments provider interface (mirrors lib/email.ts).
 *
 * Provider is per-teacher (`studio_policies.payment_provider`), not a
 * platform env var. Stripe SDK is only constructed when that teacher has
 * BYO keys. Manual is the zero-config default.
 */

import Stripe from "stripe";

export interface CheckoutSessionArgs {
  secretKey: string;
  invoiceId: string;
  teacherId: string;
  amountCents: number;
  currency: string;
  familyName: string;
  studioName: string;
  periodLabel: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}

export async function createCheckoutSession(
  args: CheckoutSessionArgs
): Promise<CheckoutSessionResult> {
  const stripe = createStripeClient(args.secretKey);
  const studio = args.studioName.trim() || "Studio";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: args.currency.toLowerCase(),
          unit_amount: args.amountCents,
          product_data: {
            name: `Invoice — ${args.periodLabel}`,
            description: `${studio} · ${args.familyName}`,
          },
        },
      },
    ],
    metadata: {
      invoice_id: args.invoiceId,
      teacher_id: args.teacherId,
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session created without a URL");
  }

  return { sessionId: session.id, url: session.url };
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
  secretKey: string
): Stripe.Event {
  const stripe = createStripeClient(secretKey);
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
