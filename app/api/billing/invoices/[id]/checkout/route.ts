import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { createCheckoutSession } from "@/lib/payments";
import { requestOrigin } from "@/lib/server/http";
import { familyDisplayName, stripeCheckoutPrefillEmail } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";

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

  const policy = await getPolicy(supabase, user.id);
  if (policy.payment_provider !== "stripe" || !policy.stripe_secret_key) {
    return NextResponse.json(
      { error: "Stripe is not configured for this studio" },
      { status: 400 }
    );
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `
      *,
      guardians (
        id, name, family_name, email, secondary_email, email_recipients
      )
    `
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status !== "sent" && invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Checkout is only available for draft or sent invoices" },
      { status: 400 }
    );
  }
  if (invoice.subtotal_cents <= 0) {
    return NextResponse.json(
      { error: "Invoice total must be greater than zero" },
      { status: 400 }
    );
  }

  if (invoice.stripe_checkout_url && invoice.status === "sent") {
    return NextResponse.json({
      url: invoice.stripe_checkout_url,
      sessionId: invoice.stripe_checkout_session_id,
    });
  }

  const family = oneToOne(
    invoice.guardians as
      | {
          name: string;
          family_name: string | null;
          email: string | null;
          secondary_email: string | null;
          email_recipients: "primary" | "secondary" | "both" | null;
        }
      | {
          name: string;
          family_name: string | null;
          email: string | null;
          secondary_email: string | null;
          email_recipients: "primary" | "secondary" | "both" | null;
        }[]
      | null
  );
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 400 });
  }

  const origin = requestOrigin(req);
  const periodLabel = `${invoice.period_start} – ${invoice.period_end}`;

  try {
    const session = await createCheckoutSession({
      secretKey: policy.stripe_secret_key,
      invoiceId: id,
      teacherId: user.id,
      amountCents: invoice.subtotal_cents,
      currency: invoice.currency,
      familyName: familyDisplayName(family),
      studioName: policy.studio_name,
      periodLabel,
      successUrl: `${origin}/billing/${id}?paid=1`,
      cancelUrl: `${origin}/billing/${id}`,
      customerEmail: stripeCheckoutPrefillEmail(family),
    });

    await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.sessionId,
        stripe_checkout_url: session.url,
      })
      .eq("id", id)
      .eq("teacher_id", user.id);

    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe checkout failed:", message);
    return NextResponse.json(
      { error: `Stripe error: ${message}` },
      { status: 500 }
    );
  }
}
