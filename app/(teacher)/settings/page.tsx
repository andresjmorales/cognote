import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { StudioSettingsForm } from "@/components/teacher/settings/StudioSettingsForm";
import { PolicySettings } from "@/components/teacher/schedule/PolicySettings";

export const metadata = { title: "Studio Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted text-sm mt-1">
          Your studio, your rules — everything here is a setting, not a
          hardcoded policy.
        </p>
      </div>

      <div className="space-y-6">
        <StudioSettingsForm policy={policy} />
        <PolicySettings policy={policy} defaultOpen />
      </div>
    </div>
  );
}
