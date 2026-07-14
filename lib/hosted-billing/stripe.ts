/**
 * Platform Stripe for CogNote Hosted Pro subscriptions.
 * Separate from teachers' BYO lesson-payment keys in studio_policies.
 */

import Stripe from "stripe";

export function getPlatformStripeSecret(
  env: Record<string, string | undefined> = process.env
): string | null {
  return env.HOSTED_STRIPE_SECRET_KEY?.trim() || env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getPlatformStripeWebhookSecret(
  env: Record<string, string | undefined> = process.env
): string | null {
  return (
    env.HOSTED_STRIPE_WEBHOOK_SECRET?.trim() ||
    env.STRIPE_WEBHOOK_SECRET?.trim() ||
    null
  );
}

export function getProMonthlyPriceId(
  env: Record<string, string | undefined> = process.env
): string | null {
  return env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim() || null;
}

export function isHostedCheckoutConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(getPlatformStripeSecret(env) && getProMonthlyPriceId(env));
}

export function createPlatformStripe(
  env: Record<string, string | undefined> = process.env
): Stripe | null {
  const key = getPlatformStripeSecret(env);
  if (!key) return null;
  return new Stripe(key);
}
