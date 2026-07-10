import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { familyDisplayName } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";
import { InvoiceDetailClient } from "@/components/teacher/billing/InvoiceDetailClient";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [policy, { data: invoice }] = await Promise.all([
    getPolicy(supabase, user.id),
    supabase
      .from("invoices")
      .select(
        `
        *,
        guardians ( name, family_name ),
        invoice_items ( * )
      `
      )
      .eq("id", id)
      .eq("teacher_id", user.id)
      .single(),
  ]);

  if (!invoice) notFound();

  const family = oneToOne(
    invoice.guardians as
      | { name: string; family_name: string | null }
      | { name: string; family_name: string | null }[]
      | null
  );

  const items = (
    (invoice.invoice_items as {
      id: string;
      lesson_id: string | null;
      description: string;
      quantity: number;
      unit_cents: number;
      amount_cents: number;
      sort_order: number;
    }[]) ?? []
  )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      id: i.id,
      lessonId: i.lesson_id,
      description: i.description,
      quantity: i.quantity,
      unitCents: i.unit_cents,
      amountCents: i.amount_cents,
    }));

  return (
    <div>
      <Link
        href="/billing"
        className="text-sm text-muted hover:text-foreground mb-4 inline-block"
      >
        ← Billing
      </Link>
      <InvoiceDetailClient
        invoiceId={invoice.id}
        status={invoice.status}
        currency={invoice.currency}
        initialItems={items}
        initialNotes={invoice.notes ?? ""}
        familyName={family ? familyDisplayName(family) : "Family"}
        periodStart={invoice.period_start}
        periodEnd={invoice.period_end}
        subtotalCents={invoice.subtotal_cents}
        paymentProvider={policy.payment_provider}
        stripeConfigured={!!policy.stripe_secret_key}
        checkoutUrl={invoice.stripe_checkout_url}
        paymentInstructions={policy.payment_instructions}
      />
    </div>
  );
}
