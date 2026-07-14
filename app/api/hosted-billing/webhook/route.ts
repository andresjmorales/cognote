import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createPlatformStripe,
  getPlatformStripeWebhookSecret,
} from "@/lib/hosted-billing/stripe";
import type Stripe from "stripe";

/**
 * Platform Stripe webhook for CogNote Hosted Pro subscriptions.
 * Distinct from per-teacher lesson payment webhooks under /api/webhooks/stripe/[teacherId].
 */
export async function POST(req: NextRequest) {
  const stripe = createPlatformStripe();
  const secret = getPlatformStripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Hosted billing webhook not configured" },
      { status: 503 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("hosted billing webhook verify:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const teacherId =
          session.metadata?.teacher_id || session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (!teacherId || !subscriptionId) break;
        await service
          .from("teachers")
          .update({
            hosted_plan: "pro",
            stripe_subscription_id: subscriptionId,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
          })
          .eq("id", teacherId);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const teacherId = sub.metadata?.teacher_id;
        const active =
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due";
        if (teacherId) {
          if (active && event.type === "customer.subscription.updated") {
            await service
              .from("teachers")
              .update({
                hosted_plan: "pro",
                stripe_subscription_id: sub.id,
              })
              .eq("id", teacherId);
          } else if (!active || event.type === "customer.subscription.deleted") {
            await service
              .from("teachers")
              .update({
                hosted_plan: "free",
                stripe_subscription_id: null,
              })
              .eq("id", teacherId);
          }
        } else if (sub.customer) {
          const customerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          if (!active || event.type === "customer.subscription.deleted") {
            await service
              .from("teachers")
              .update({
                hosted_plan: "free",
                stripe_subscription_id: null,
              })
              .eq("stripe_customer_id", customerId);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("hosted billing webhook handler:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
