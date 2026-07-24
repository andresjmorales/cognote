import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentMode } from "@/lib/entitlements";
import {
  createPlatformStripe,
  isHostedCheckoutConfigured,
} from "@/lib/hosted-billing/stripe";

/**
 * Stripe Customer Portal for CogNote Hosted Pro (cancel / payment method).
 * Distinct from teacher BYO lesson Stripe in Settings → Payments.
 */
export async function POST(request: Request) {
  if (getDeploymentMode() !== "hosted") {
    return NextResponse.json(
      { error: "Hosted billing is not enabled on this deployment" },
      { status: 400 }
    );
  }

  if (!isHostedCheckoutConfigured()) {
    return NextResponse.json(
      { error: "Billing portal is not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!teacher?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing customer yet. Upgrade first." },
      { status: 400 }
    );
  }

  const stripe = createPlatformStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing portal is not configured" },
      { status: 503 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin =
    siteUrl ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(request.url).origin || "http://localhost:3000");

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: teacher.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed.";
    console.error("[hosted-billing/portal]", message);
    if (/no such customer/i.test(message) || /resource_missing/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Stripe customer not found for these API keys. Test-mode customers do not exist in live mode — Upgrade again with the current keys.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
