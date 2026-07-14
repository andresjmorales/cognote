"use client";

import Link from "next/link";
import {
  formatHostedPrice,
  planDisplayName,
  type HostedPlan,
} from "@/lib/entitlements";

export function HostedLimitBanner({
  message,
  monthlyPriceCents,
}: {
  message?: string | null;
  monthlyPriceCents: number;
}) {
  const price = formatHostedPrice(monthlyPriceCents);
  return (
    <div
      role="status"
      className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm mb-4"
    >
      <p>
        {message ??
          `Free hosted plan limit reached. Upgrade to Pro (${price}/mo), or export and self-host.`}{" "}
        <Link href="/hosting" className="font-semibold text-primary underline">
          Hosting options
        </Link>
      </p>
    </div>
  );
}

export function HostedPlanSummary({
  plan,
  softLimitsApply,
  trialEndsAt,
  giftedUntil,
  foundingNumber,
  monthlyPriceCents,
  usage,
}: {
  plan: HostedPlan;
  softLimitsApply: boolean;
  trialEndsAt: string | null;
  giftedUntil: string | null;
  foundingNumber: number | null;
  monthlyPriceCents: number;
  usage: {
    students: number;
    plans: number;
    sheetMusic: number;
    limits: { maxStudents: number; maxPlans: number; maxSheetItems: number };
  };
}) {
  const price = formatHostedPrice(monthlyPriceCents);
  return (
    <div className="text-sm space-y-2">
      <p>
        <span className="font-medium">Plan:</span> {planDisplayName(plan)}
        {plan === "founding" && foundingNumber != null
          ? ` (#${foundingNumber})`
          : ""}
        {softLimitsApply ? " · free limits apply" : " · no create limits"}
      </p>
      {plan === "trial" && trialEndsAt && (
        <p className="text-muted text-xs">
          Trial ends {new Date(trialEndsAt).toLocaleDateString()}
        </p>
      )}
      {plan === "gifted" && giftedUntil && (
        <p className="text-muted text-xs">
          Gifted until {new Date(giftedUntil).toLocaleDateString()}
        </p>
      )}
      {softLimitsApply && (
        <ul className="text-xs text-muted space-y-0.5">
          <li>
            Active students: {usage.students} / {usage.limits.maxStudents}
          </li>
          <li>
            Practice lessons: {usage.plans} / {usage.limits.maxPlans}
          </li>
          <li>
            Sheet music: {usage.sheetMusic} / {usage.limits.maxSheetItems}
          </li>
        </ul>
      )}
      <p className="text-xs text-muted">
        Hosted Pro is {price}/mo. Tuition you collect from families stays
        yours.
      </p>
    </div>
  );
}
