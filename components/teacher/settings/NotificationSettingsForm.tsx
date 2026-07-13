"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy } from "@/lib/schedule";

export function NotificationSettingsForm({ policy }: { policy: StudioPolicy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inApp, setInApp] = useState(policy.notify_in_app);
  const [emailCancel, setEmailCancel] = useState(policy.notify_email_portal_cancel);
  const [emailPaid, setEmailPaid] = useState(policy.notify_email_invoice_paid);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyInApp: inApp,
        notifyEmailPortalCancel: emailCancel,
        notifyEmailInvoicePaid: emailPaid,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <Card>
      <h2 className="font-semibold text-lg mb-1">Notifications</h2>
      <p className="text-sm text-muted mb-4">
        In-app bell (no push yet) and optional email for family portal
        cancellations and Stripe payment receipts.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={inApp}
            onChange={(e) => setInApp(e.target.checked)}
          />
          <span>
            <span className="font-medium">In-app notifications</span>
            <span className="block text-xs text-muted">
              Show events in the bell in the top bar.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={emailCancel}
            onChange={(e) => setEmailCancel(e.target.checked)}
          />
          <span>
            <span className="font-medium">Email me when a family cancels</span>
            <span className="block text-xs text-muted">
              Portal cancellations only (not teacher-marked cancels).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={emailPaid}
            onChange={(e) => setEmailPaid(e.target.checked)}
          />
          <span>
            <span className="font-medium">Email me a receipt when an invoice is paid online</span>
            <span className="block text-xs text-muted">
              Stripe Checkout payments. Includes family, amount, and period.
            </span>
          </span>
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save notification settings"}
        </Button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </form>
    </Card>
  );
}
