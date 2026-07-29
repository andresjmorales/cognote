import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AccountSettings } from "@/components/teacher/AccountSettings";
import { HostingSettingsForm } from "@/components/teacher/settings/HostingSettingsForm";
import { HostedLimitBanner } from "@/components/teacher/HostedLimitBanner";
import { TimezoneSettingsForm } from "@/components/teacher/settings/TimezoneSettingsForm";
import { NotificationSettingsForm } from "@/components/teacher/settings/NotificationSettingsForm";
import { OptionalAiSettingsForm } from "@/components/teacher/settings/OptionalAiSettingsForm";
import { SpreadsheetImportSettings } from "@/components/teacher/settings/SpreadsheetImportSettings";
import { DataTransferSettings } from "@/components/teacher/settings/DataTransferSettings";
import { getPolicy } from "@/lib/server/scheduling";
import { maskSecret } from "@/lib/billing";
import {
  getDeploymentMode,
  resolveEffectivePlan,
  type HostedPlan,
} from "@/lib/entitlements";
import {
  countActiveStudents,
  countPlans,
  countSheetItems,
  loadTeacherEntitlements,
  persistDemotionIfNeeded,
} from "@/lib/server/entitlements";
import { isHostedCheckoutConfigured } from "@/lib/hosted-billing/stripe";

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ hosted?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const params = await searchParams;

  const { data: teacher } = await supabase
    .from("teachers")
    .select(
      "display_name, avatar_url, email, created_at, stripe_customer_id, stripe_cancel_at"
    )
    .eq("id", user.id)
    .single();

  const policy = await getPolicy(supabase, user.id);
  const clientPolicy = {
    ...policy,
    stripe_secret_key: null,
    stripe_publishable_key: null,
    stripe_webhook_secret: null,
    ai_api_key: null,
  };

  let hostingSection: React.ReactNode = null;
  let limitBanner: React.ReactNode = null;

  if (getDeploymentMode() === "hosted") {
    const stored = await loadTeacherEntitlements(supabase, user.id);
    const entitlement = resolveEffectivePlan(stored);
    await persistDemotionIfNeeded(
      supabase,
      user.id,
      stored,
      entitlement.demotedFrom
    );
    const [students, plans, sheetMusic] = await Promise.all([
      countActiveStudents(supabase, user.id),
      countPlans(supabase, user.id),
      countSheetItems(supabase, user.id),
    ]);

    if (entitlement.softLimitsApply) {
      limitBanner = (
        <HostedLimitBanner monthlyPriceCents={entitlement.monthlyPriceCents} />
      );
    }

    hostingSection = (
      <div className="mb-6">
        <HostingSettingsForm
          plan={entitlement.plan as HostedPlan}
          softLimitsApply={entitlement.softLimitsApply}
          trialEndsAt={entitlement.trialEndsAt?.toISOString() ?? null}
          giftedUntil={entitlement.giftedUntil?.toISOString() ?? null}
          foundingNumber={stored?.founding_number ?? null}
          monthlyPriceCents={entitlement.monthlyPriceCents}
          checkoutConfigured={isHostedCheckoutConfigured()}
          hasStripeCustomer={Boolean(teacher?.stripe_customer_id)}
          stripeCancelAt={teacher?.stripe_cancel_at ?? null}
          usage={{
            students,
            plans,
            sheetMusic,
            limits: entitlement.limits,
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

      {params.hosted === "success" && (
        <p className="text-sm text-success mb-4">
          Payment received. Your plan updates when Stripe confirms.
        </p>
      )}
      {params.hosted === "cancel" && (
        <p className="text-sm text-muted mb-4">Checkout canceled.</p>
      )}

      {limitBanner}
      {hostingSection}

      <Card padding="sm" className="mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted">Email</div>
            <div className="font-medium">{user.email ?? teacher?.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Member Since</div>
            <div className="font-medium">
              {new Date(teacher?.created_at ?? user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <AccountSettings
          initialName={teacher?.display_name ?? ""}
          initialAvatarUrl={teacher?.avatar_url ?? null}
          currentEmail={user.email ?? teacher?.email ?? ""}
        />

        <TimezoneSettingsForm timezone={policy.timezone} />
        <NotificationSettingsForm policy={clientPolicy} />
        <OptionalAiSettingsForm
          policy={clientPolicy}
          aiStatus={{
            configured: Boolean(policy.ai_api_key),
            masked: maskSecret(policy.ai_api_key),
          }}
        />
        <SpreadsheetImportSettings
          aiConfigured={
            policy.ai_provider !== "none" && Boolean(policy.ai_api_key)
          }
        />
        <DataTransferSettings />
      </div>
    </div>
  );
}
