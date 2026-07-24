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

type ServiceClient = ReturnType<typeof createServiceClient>;

function cancelAtIso(sub: Stripe.Subscription): string | null {
  if (typeof sub.cancel_at === "number" && sub.cancel_at > 0) {
    return new Date(sub.cancel_at * 1000).toISOString();
  }
  return null;
}

function subscriptionIsActive(status: Stripe.Subscription.Status): boolean {
  return (
    status === "active" || status === "trialing" || status === "past_due"
  );
}

/** Promote to Pro; never overwrite founding. */
async function applyPro(
  service: ServiceClient,
  teacherId: string,
  fields: {
    stripe_subscription_id: string;
    stripe_customer_id?: string;
    stripe_cancel_at?: string | null;
  }
) {
  const { data: row } = await service
    .from("teachers")
    .select("hosted_plan")
    .eq("id", teacherId)
    .maybeSingle();
  if (row?.hosted_plan === "founding") {
    await service
      .from("teachers")
      .update({
        stripe_subscription_id: fields.stripe_subscription_id,
        ...(fields.stripe_customer_id
          ? { stripe_customer_id: fields.stripe_customer_id }
          : {}),
        ...(fields.stripe_cancel_at !== undefined
          ? { stripe_cancel_at: fields.stripe_cancel_at }
          : {}),
      })
      .eq("id", teacherId);
    return;
  }
  await service
    .from("teachers")
    .update({
      hosted_plan: "pro",
      stripe_subscription_id: fields.stripe_subscription_id,
      ...(fields.stripe_customer_id
        ? { stripe_customer_id: fields.stripe_customer_id }
        : {}),
      ...(fields.stripe_cancel_at !== undefined
        ? { stripe_cancel_at: fields.stripe_cancel_at }
        : {}),
    })
    .eq("id", teacherId);
}

/**
 * Demote Stripe Pro → free. Never touch founding or gifted rows
 * (manual / SQL entitlements stay authoritative).
 */
async function demoteFromPro(
  service: ServiceClient,
  filter: { teacherId?: string; customerId?: string }
) {
  let query = service
    .from("teachers")
    .update({
      hosted_plan: "free",
      stripe_subscription_id: null,
      stripe_cancel_at: null,
    })
    .eq("hosted_plan", "pro");

  if (filter.teacherId) {
    query = query.eq("id", filter.teacherId);
  } else if (filter.customerId) {
    query = query.eq("stripe_customer_id", filter.customerId);
  } else {
    return;
  }
  await query;
}

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
        await applyPro(service, teacherId, {
          stripe_subscription_id: subscriptionId,
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          stripe_cancel_at: null,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const teacherId = sub.metadata?.teacher_id;
        const active = subscriptionIsActive(sub.status);
        const cancelAt = cancelAtIso(sub);

        if (teacherId) {
          if (active && event.type !== "customer.subscription.deleted") {
            await applyPro(service, teacherId, {
              stripe_subscription_id: sub.id,
              stripe_cancel_at: cancelAt,
            });
          } else if (!active || event.type === "customer.subscription.deleted") {
            await demoteFromPro(service, { teacherId });
          }
        } else if (sub.customer) {
          const customerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          if (active && event.type !== "customer.subscription.deleted") {
            const { data: row } = await service
              .from("teachers")
              .select("id, hosted_plan")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();
            if (row?.id && row.hosted_plan !== "founding") {
              await applyPro(service, row.id, {
                stripe_subscription_id: sub.id,
                stripe_cancel_at: cancelAt,
              });
            } else if (row?.id && row.hosted_plan === "founding") {
              await service
                .from("teachers")
                .update({
                  stripe_subscription_id: sub.id,
                  stripe_cancel_at: cancelAt,
                })
                .eq("id", row.id);
            }
          } else {
            await demoteFromPro(service, { customerId });
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
