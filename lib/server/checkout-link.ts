import type { SupabaseClient } from "@supabase/supabase-js";
import { getPolicy } from "@/lib/server/scheduling";
import { expireCheckoutSession } from "@/lib/payments";

/**
 * Expire an invoice's Stripe checkout session because the amount it charges
 * is out of date (a payment was recorded, or a draft's total changed).
 * Best effort: a Stripe failure is logged, not thrown. The caller still
 * clears `stripe_checkout_session_id` / `stripe_checkout_url` so the old
 * link is never reused, and a fresh one is made for the current balance.
 */
export async function expireStaleCheckoutLink(
  supabase: SupabaseClient,
  teacherId: string,
  sessionId: string,
  reason: string
): Promise<void> {
  const policy = await getPolicy(supabase, teacherId);
  if (!policy.stripe_secret_key) return;
  try {
    await expireCheckoutSession(policy.stripe_secret_key, sessionId);
  } catch (err) {
    console.error(
      `Expire Stripe checkout after ${reason} failed:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/** Columns to null when an invoice's checkout link is retired. */
export const CLEARED_CHECKOUT_LINK = {
  stripe_checkout_session_id: null,
  stripe_checkout_url: null,
} as const;
