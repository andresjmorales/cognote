import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { StudioSettingsForm } from "@/components/teacher/settings/StudioSettingsForm";
import { PolicySettings } from "@/components/teacher/schedule/PolicySettings";
import { BillingSettingsForm } from "@/components/teacher/settings/BillingSettingsForm";
import { PaymentsSettingsForm } from "@/components/teacher/settings/PaymentsSettingsForm";
import { DataTransferSettings } from "@/components/teacher/settings/DataTransferSettings";
import { NotificationSettingsForm } from "@/components/teacher/settings/NotificationSettingsForm";
import { stripeStatusFromPolicy } from "@/lib/billing";

export const metadata = { title: "Studio Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  // Never pass raw Stripe secrets into client components
  const clientPolicy = {
    ...policy,
    stripe_secret_key: null,
    stripe_publishable_key: null,
    stripe_webhook_secret: null,
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted text-sm mt-1">
          Your studio name, timezone, lesson lengths, cancellation and make-up
          policies, billing rules, and payment options. These drive scheduling,
          invoices, and what families see on their portal.
        </p>
      </div>

      <div className="space-y-6">
        <StudioSettingsForm policy={clientPolicy} />
        <PolicySettings policy={clientPolicy} defaultOpen />
        <BillingSettingsForm policy={clientPolicy} />
        <PaymentsSettingsForm
          policy={clientPolicy}
          teacherId={user.id}
          stripeStatus={stripeStatusFromPolicy(policy)}
        />
        <NotificationSettingsForm policy={clientPolicy} />
        <DataTransferSettings />
      </div>
    </div>
  );
}
