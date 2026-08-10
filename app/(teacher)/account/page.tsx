import { createClient } from "@/lib/supabase/server";
import { AccountSettings } from "@/components/teacher/AccountSettings";
import { HostingSettingsForm } from "@/components/teacher/settings/HostingSettingsForm";
import { HostedLimitBanner } from "@/components/teacher/HostedLimitBanner";
import { NotificationSettingsForm } from "@/components/teacher/settings/NotificationSettingsForm";
import { OptionalAiSettingsForm } from "@/components/teacher/settings/OptionalAiSettingsForm";
import { SpreadsheetImportSettings } from "@/components/teacher/settings/SpreadsheetImportSettings";
import { DataTransferSettings } from "@/components/teacher/settings/DataTransferSettings";
import { getPolicy } from "@/lib/server/scheduling";
import { maskSecret } from "@/lib/billing";
import {
  getDeploymentMode,
  hostedLimitMessage,
  resolveEffectivePlan,
  type HostedPlan,
  type LimitResource,
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

    // Only warn when a free-tier cap is actually hit (not merely "on free").
    if (entitlement.softLimitsApply) {
      const hit: LimitResource | null =
        students >= entitlement.limits.maxStudents
          ? "students"
          : plans >= entitlement.limits.maxPlans
            ? "plans"
            : sheetMusic >= entitlement.limits.maxSheetItems
              ? "sheet_music"
              : null;
      if (hit) {
        const limit =
          hit === "students"
            ? entitlement.limits.maxStudents
            : hit === "plans"
              ? entitlement.limits.maxPlans
              : entitlement.limits.maxSheetItems;
        limitBanner = (
          <HostedLimitBanner
            monthlyPriceCents={entitlement.monthlyPriceCents}
            message={hostedLimitMessage(
              hit,
              limit,
              entitlement.monthlyPriceCents
            )}
          />
        );
      }
    }

    hostingSection = (
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
    );
  }

  const accountEmail = user.email ?? teacher?.email ?? "";
  const memberSinceLabel = new Date(
    teacher?.created_at ?? user.created_at
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

      <div className="space-y-6">
        <AccountSettings
          initialName={teacher?.display_name ?? ""}
          initialAvatarUrl={teacher?.avatar_url ?? null}
          currentEmail={accountEmail}
          memberSinceLabel={memberSinceLabel}
          timezone={policy.timezone}
        >
          {hostingSection}
        </AccountSettings>

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
