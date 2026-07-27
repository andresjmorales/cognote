"use client";

import { useState } from "react";
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-black/40">
          <Card padding="lg" className="w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Payment settings</h2>
                <p className="text-sm text-muted mt-1">
                  Manual payment instructions or bring-your-own Stripe for
                  family tuition invoices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground text-sm cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <PaymentsSettingsForm
              policy={policy}
              teacherId={teacherId}
              stripeStatus={stripeStatus}
              embedded
            />
          </Card>
        </div>
      )}
    </>
  );
}
