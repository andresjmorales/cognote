/**
 * Founding members get permanent hosted access for free. The plan is granted
 * in the database, but Stripe keeps billing any Pro subscription until it is
 * cancelled there too, so these helpers cancel it.
 */

import type Stripe from "stripe";

/** Subscription states that can still produce an invoice. */
const BILLABLE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

function isAlreadyGone(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "resource_missing") return true;
  return /already (been )?cancel/i.test(e.message ?? "");
}

/**
 * Cancel one subscription right away (no end-of-period wait). A subscription
 * that is already cancelled or missing counts as done. Any other error is
 * thrown so the caller (e.g. the webhook) fails and Stripe retries.
 */
export async function cancelSubscriptionNow(
  stripe: Pick<Stripe, "subscriptions">,
  subscriptionId: string
): Promise<"cancelled" | "already_gone"> {
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return "cancelled";
  } catch (err) {
    if (isAlreadyGone(err)) return "already_gone";
    throw err;
  }
}

/**
 * Cancel every subscription for a customer that could still bill them.
 * Returns the ids it cancelled.
 */
export async function cancelBillableSubscriptions(
  stripe: Pick<Stripe, "subscriptions">,
  customerId: string
): Promise<string[]> {
  const cancelled: string[] = [];
  for await (const sub of stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })) {
    if (!BILLABLE_STATUSES.has(sub.status)) continue;
    if ((await cancelSubscriptionNow(stripe, sub.id)) === "cancelled") {
      cancelled.push(sub.id);
    }
  }
  return cancelled;
}
