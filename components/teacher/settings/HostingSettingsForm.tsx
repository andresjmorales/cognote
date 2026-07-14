"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HostedPlanSummary } from "@/components/teacher/HostedLimitBanner";
import type { HostedPlan } from "@/lib/entitlements";

export function HostingSettingsForm({
  plan,
  softLimitsApply,
  trialEndsAt,
  giftedUntil,
  foundingNumber,
  monthlyPriceCents,
  checkoutConfigured,
  usage,
}: {
  plan: HostedPlan;
  softLimitsApply: boolean;
  trialEndsAt: string | null;
  giftedUntil: string | null;
  foundingNumber: number | null;
  monthlyPriceCents: number;
  checkoutConfigured: boolean;
  usage: {
    students: number;
    plans: number;
    sheetMusic: number;
    limits: { maxStudents: number; maxPlans: number; maxSheetItems: number };
  };
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canUpgrade =
    softLimitsApply || plan === "trial" || plan === "free" || plan === "gifted";

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/hosted-billing/checkout", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Could not start checkout");
        setBusy(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage("No checkout URL returned");
      setBusy(false);
    } catch {
      setMessage("Could not start checkout");
      setBusy(false);
    }
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-1">Hosting plan</h2>
      <p className="text-sm text-muted mb-3">
        Your CogNote subscription on this hosted site. Family tuition (Zelle,
        Venmo, or your own Stripe) is separate — see Studio Settings → Payments.
      </p>
      <HostedPlanSummary
        plan={plan}
        softLimitsApply={softLimitsApply}
        trialEndsAt={trialEndsAt}
        giftedUntil={giftedUntil}
        foundingNumber={foundingNumber}
        monthlyPriceCents={monthlyPriceCents}
        usage={usage}
      />
      <div className="flex flex-wrap gap-2 mt-4">
        {canUpgrade && checkoutConfigured && (
          <Button
            type="button"
            size="sm"
            disabled={busy || plan === "pro" || plan === "founding"}
            onClick={startCheckout}
          >
            {busy ? "…" : "Upgrade to Pro"}
          </Button>
        )}
        {canUpgrade && !checkoutConfigured && (
          <a href="mailto:support@cognote.studio?subject=CogNote%20Pro">
            <Button type="button" size="sm" variant="secondary">
              Email support to upgrade
            </Button>
          </a>
        )}
        <Link href="/hosting">
          <Button type="button" size="sm" variant="secondary">
            Hosting options
          </Button>
        </Link>
      </div>
      {message && <p className="text-sm text-error mt-2">{message}</p>}
    </Card>
  );
}
