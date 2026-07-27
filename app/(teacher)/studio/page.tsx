import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { StudioSettingsForm } from "@/components/teacher/settings/StudioSettingsForm";
import { PolicySettings } from "@/components/teacher/schedule/PolicySettings";
import { BillingSettingsForm } from "@/components/teacher/settings/BillingSettingsForm";
import { StreakSettingsForm } from "@/components/teacher/settings/StreakSettingsForm";

export const metadata = { title: "Studio" };

export default async function StudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  // Never pass raw secrets into client components
  const clientPolicy = {
    ...policy,
    stripe_secret_key: null,
    stripe_publishable_key: null,
    stripe_webhook_secret: null,
    ai_api_key: null,
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Studio</h1>
        <p className="text-muted text-sm mt-1">
          Your studio name, lesson lengths, cancellation and make-up policy,
          rates, and practice streaks. These drive scheduling, invoices, and
          what families see on their portal.
        </p>
      </div>

      <div className="space-y-6">
        <StudioSettingsForm policy={clientPolicy} />
        <PolicySettings policy={clientPolicy} defaultOpen />
        <BillingSettingsForm policy={clientPolicy} />
        <StreakSettingsForm policy={clientPolicy} />
      </div>
    </div>
  );
}
