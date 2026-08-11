"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { centsToDollarsInput, dollarsToCents } from "@/lib/billing";
import type { StudioPolicy, InvoiceCadence } from "@/lib/schedule";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

function durationInputsFromPolicy(
  policy: StudioPolicy
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const minutes of policy.lesson_duration_options) {
    const cents = policy.duration_rate_cents[minutes];
    out[String(minutes)] = cents != null ? centsToDollarsInput(cents) : "";
  }
  return out;
}

export function BillingSettingsForm({ policy }: { policy: StudioPolicy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [defaultRate, setDefaultRate] = useState(
    centsToDollarsInput(policy.default_rate_cents)
  );
  const [travelFee, setTravelFee] = useState(
    centsToDollarsInput(policy.travel_fee_cents)
  );
  const [durationRates, setDurationRates] = useState(() =>
    durationInputsFromPolicy(policy)
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

  const durationOptions = useMemo(
    () => [...policy.lesson_duration_options].sort((a, b) => a - b),
    [policy.lesson_duration_options]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const rateCents =
      defaultRate.trim() === "" ? null : dollarsToCents(defaultRate);
    if (defaultRate.trim() !== "" && rateCents === null) {
      setMessage("Enter a valid default rate (e.g. 45.00)");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    const travelFeeCents =
      travelFee.trim() === "" ? null : dollarsToCents(travelFee);
    if (travelFee.trim() !== "" && travelFeeCents === null) {
      setMessage("Enter a valid travel fee (e.g. 5.00)");
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    const durationRateCents: Record<string, number> = {};
    for (const minutes of durationOptions) {
      const raw = (durationRates[String(minutes)] ?? "").trim();
      if (!raw) continue;
      const cents = dollarsToCents(raw);
      if (cents === null) {
        setMessage(`Enter a valid rate for ${minutes} min lessons`);
        setTimeout(() => setMessage(null), 2500);
        return;
      }
      durationRateCents[String(minutes)] = cents;
    }

    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultRateCents: rateCents,
        // UI only offers hourly pricing; per_lesson remains supported in the API.
        rateBasis: "per_hour",
        durationRateCents,
        travelFeeCents,
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

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Rates</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm">
          <p className="font-medium">Hourly rate (pro-rated)</p>
          <p className="text-xs text-muted mt-0.5">
            The default rate scales with lesson length (e.g. $60/hr → $30 for 30
            min, $45 for 45 min). Prefer this for most studios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Default rate / hour
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="60.00"
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

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted mb-1">
            Custom rates by lesson length (optional)
          </legend>
          <p className="text-xs text-muted">
            When a length has its own amount, that lesson is charged flat instead
            of the studio hourly default — useful if 20 min is $30, 30 min is $40,
            and 45 min is $60. Per-slot and per-student rates still win when set.
            Edit which lengths appear under Studio → time blocks.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {durationOptions.map((minutes) => (
              <label key={minutes} className="text-sm">
                <span className="block text-xs font-semibold text-muted mb-1">
                  {minutes} min lesson
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={durationRates[String(minutes)] ?? ""}
                    onChange={(e) =>
                      setDurationRates((prev) => ({
                        ...prev,
                        [String(minutes)]: e.target.value,
                      }))
                    }
                    placeholder="Use hourly"
                    className={`${inputClass} w-full`}
                  />
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Travel fee (home visits)
          </span>
          <div className="flex items-center gap-2 max-w-xs">
            <span className="text-muted text-sm">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={travelFee}
              onChange={(e) => setTravelFee(e.target.value)}
              placeholder="5.00"
              className={`${inputClass} w-full`}
            />
          </div>
          <span className="block text-xs text-muted mt-1">
            Flat add-on only for lessons marked as a home visit (not applied
            retroactively). Slot changes affect upcoming lessons; override any
            single occurrence from the schedule. Per-student override on their
            page. Leave blank for none.
          </span>
        </label>

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
