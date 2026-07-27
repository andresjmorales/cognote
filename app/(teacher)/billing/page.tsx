import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { toLocalDateString } from "@/lib/schedule";
import { defaultInvoicePeriod, stripeStatusFromPolicy } from "@/lib/billing";
import { familyDisplayName } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";
import { Card } from "@/components/ui/card";
import { BillingListActions } from "@/components/teacher/billing/BillingList";
import { InvoiceList } from "@/components/teacher/billing/InvoiceList";
import { PaymentSettingsButton } from "@/components/teacher/billing/PaymentSettingsButton";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  const period = defaultInvoicePeriod(today, policy.invoice_cadence);

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, period_start, period_end, status, subtotal_cents, currency, created_at, guardians ( name, family_name )"
    )
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (invoices ?? []).map((inv) => {
    const family = oneToOne(
      inv.guardians as
        | { name: string; family_name: string | null }
        | { name: string; family_name: string | null }[]
        | null
    );
    return {
      id: inv.id,
      familyName: family ? familyDisplayName(family) : "Family",
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      status: inv.status,
      subtotalCents: inv.subtotal_cents,
      currency: inv.currency,
    };
  });

  const clientPolicy = {
    ...policy,
    stripe_secret_key: null,
    stripe_publishable_key: null,
    stripe_webhook_secret: null,
    ai_api_key: null,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted text-sm mt-1">
            Typical month: Generate for last month → review drafts → select all
            → Send. Rates and billability live in Studio; configure Stripe or
            payment instructions via Payment settings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PaymentSettingsButton
            policy={clientPolicy}
            teacherId={user.id}
            stripeStatus={stripeStatusFromPolicy(policy)}
          />
          <BillingListActions
            defaultStart={period.start}
            defaultEnd={period.end}
            currency={policy.currency}
          />
        </div>
      </div>

      <Card padding="sm">
        {!rows.length ? (
          <p className="text-sm text-muted py-4 text-center">
            No invoices yet. Mark attendance for a period, then generate drafts.
          </p>
        ) : (
          <InvoiceList invoices={rows} />
        )}
      </Card>
    </div>
  );
}
