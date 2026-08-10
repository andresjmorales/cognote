"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentsSettingsForm } from "@/components/teacher/settings/PaymentsSettingsForm";
import type { StudioPolicy } from "@/lib/schedule";
import type { StripeKeyStatus } from "@/lib/billing";

export function PaymentSettingsButton({
  policy,
  teacherId,
  stripeStatus,
}: {
  policy: StudioPolicy;
  teacherId: string;
  stripeStatus: StripeKeyStatus;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        Payment settings
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-settings-title"
        >
          <Card
            padding="none"
            className="w-full max-w-lg max-h-[84vh] flex flex-col shadow-lg overflow-hidden"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border bg-surface">
              <div>
                <h2
                  id="payment-settings-title"
                  className="text-lg font-semibold"
                >
                  Payment settings
                </h2>
                <p className="text-sm text-muted mt-1">
                  Manual instructions or your own Stripe account for family
                  tuition.{" "}
                  <Link
                    href="/help#billing-payments"
                    className="text-primary hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Help
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground text-sm cursor-pointer shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-dim"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <PaymentsSettingsForm
                policy={policy}
                teacherId={teacherId}
                stripeStatus={stripeStatus}
                embedded
                onSaved={() => setOpen(false)}
              />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
