"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { centsToDollarsInput, dollarsToCents } from "@/lib/billing";
import type { StudioPolicy, InvoiceCadence, RateBasis } from "@/lib/schedule";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function BillingSettingsForm({ policy }: { policy: StudioPolicy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [defaultRate, setDefaultRate] = useState(
    centsToDollarsInput(policy.default_rate_cents)
  );
  const [rateBasis, setRateBasis] = useState<RateBasis>(
    policy.rate_basis ?? "per_hour"
  );
  const [currency, setCurrency] = useState(policy.currency || "USD");
  const [cadence, setCadence] = useState<InvoiceCadence>(policy.invoice_cadence);
  const [billAttended, setBillAttended] = useState(policy.bill_attended);
  const [billNoShow, setBillNoShow] = useState(policy.bill_no_show);
  const [billTeacherCancel, setBillTeacherCancel] = useState(
    policy.bill_teacher_cancel
  );
  const [billTimelyCancel, setBillTimelyCancel] = useState(
    policy.bill_timely_student_cancel
  );
  const [billLateCancel, setBillLateCancel] = useState(
    policy.bill_late_student_cancel
  );
  const [billMakeup, setBillMakeup] = useState(policy.bill_makeup);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const rateCents =
      defaultRate.trim() === "" ? null : dollarsToCents(defaultRate);
    if (defaultRate.trim() !== "" && rateCents === null) {
      setMessage("Enter a valid default rate (e.g. 45.00)");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultRateCents: rateCents,
        rateBasis,
        currency: currency.trim().toUpperCase() || "USD",
        invoiceCadence: cadence,
        billAttended,
        billNoShow,
        billTeacherCancel,
        billTimelyStudentCancel: billTimelyCancel,
        billLateStudentCancel: billLateCancel,
        billMakeup,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  const rateSuffix = rateBasis === "per_hour" ? "/ hour" : "/ lesson";

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Rates</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-1">
            How are rates priced?
          </legend>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="rateBasis"
                className="mt-1"
                checked={rateBasis === "per_lesson"}
                onChange={() => setRateBasis("per_lesson")}
              />
              <span>
                <span className="font-medium">Per lesson (flat)</span>
                <span className="block text-xs text-muted">
                  A 30-minute and a 45-minute lesson cost the same configured
                  rate.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="rateBasis"
                className="mt-1"
                checked={rateBasis === "per_hour"}
                onChange={() => setRateBasis("per_hour")}
              />
              <span>
                <span className="font-medium">Per hour (pro-rated)</span>
                <span className="block text-xs text-muted">
                  Charge scales with length (e.g. $45/hr → $22.50 for 30 min,
                  $33.75 for 45 min.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Default rate {rateSuffix}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="45.00"
                className={`${inputClass} w-full`}
              />
            </div>
            <span className="block text-xs text-muted mt-1">
              Fallback when a slot or student has no rate. Leave blank for none.
            </span>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Currency
            </span>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              className={`${inputClass} w-full uppercase`}
            />
          </label>
        </div>

        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Generate invoices (default dates)
          </span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as InvoiceCadence)}
            className={`${inputClass} w-full`}
          >
            <option value="monthly">
              Previous calendar month (typical monthly billing)
            </option>
            <option value="manual">Month-to-date (1st through today)</option>
          </select>
          <span className="block text-xs text-muted mt-1">
            Only pre-fills the Generate dialog. You can always change the
            range before creating drafts.
          </span>
        </label>

        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-1">
            What appears on invoices?
          </legend>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billAttended}
                onChange={(e) => setBillAttended(e.target.checked)}
              />
              Attended lessons
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billNoShow}
                onChange={(e) => setBillNoShow(e.target.checked)}
              />
              No-shows
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billLateCancel}
                onChange={(e) => setBillLateCancel(e.target.checked)}
              />
              Late student cancellations
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billTimelyCancel}
                onChange={(e) => setBillTimelyCancel(e.target.checked)}
              />
              Timely student cancellations
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billTeacherCancel}
                onChange={(e) => setBillTeacherCancel(e.target.checked)}
              />
              Teacher cancellations
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billMakeup}
                onChange={(e) => setBillMakeup(e.target.checked)}
              />
              Make-up lessons (redeeming a credit)
            </label>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving..." : "Save Rates"}
          </Button>
          {message && <span className="text-xs text-muted">{message}</span>}
        </div>
      </form>
    </Card>
  );
}
