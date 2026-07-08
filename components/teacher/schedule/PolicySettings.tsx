"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy } from "@/lib/schedule";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

/**
 * Studio policies are per-teacher settings, not hardcoded rules (ROADMAP §3).
 * These options drive make-up credit derivation now and billing in Phase 3.
 */
export function PolicySettings({
  policy,
  defaultOpen = false,
}: {
  policy: StudioPolicy;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [timezone, setTimezone] = useState(policy.timezone);
  const [windowHours, setWindowHours] = useState(policy.cancellation_window_hours);
  const [timelyEarns, setTimelyEarns] = useState(policy.timely_cancel_earns_makeup);
  const [lateEarns, setLateEarns] = useState(policy.late_cancel_earns_makeup);
  const [noShowEarns, setNoShowEarns] = useState(policy.no_show_earns_makeup);
  const [teacherEarns, setTeacherEarns] = useState(policy.teacher_cancel_earns_makeup);
  const [expiryDays, setExpiryDays] = useState<string>(
    policy.makeup_credit_expiry_days?.toString() ?? ""
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone,
        cancellationWindowHours: windowHours,
        timelyCancelEarnsMakeup: timelyEarns,
        lateCancelEarnsMakeup: lateEarns,
        noShowEarnsMakeup: noShowEarns,
        teacherCancelEarnsMakeup: teacherEarns,
        makeupCreditExpiryDays: expiryDays ? Number(expiryDays) : null,
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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <h2 className="font-semibold">Studio Policy</h2>
        <span className="text-muted text-sm">{open ? "▴" : "▾"}</span>
      </button>
      {!open && (
        <p className="text-xs text-muted mt-1">
          {windowHours}h cancellation window · your rules, not ours — everything here is
          a setting.
        </p>
      )}

      {open && (
        <form onSubmit={handleSave} className="flex flex-col gap-3 mt-3">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Studio timezone
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Cancellation notice window (hours)
            </span>
            <input
              type="number"
              min={0}
              max={168}
              value={windowHours}
              onChange={(e) => setWindowHours(Number(e.target.value))}
              className={`${inputClass} w-full`}
            />
            <span className="block text-xs text-muted mt-1">
              Cancellations with less notice than this count as “late.”
            </span>
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-muted mb-1">
              What earns a make-up credit?
            </legend>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timelyEarns}
                  onChange={(e) => setTimelyEarns(e.target.checked)}
                />
                Student cancels with enough notice
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lateEarns}
                  onChange={(e) => setLateEarns(e.target.checked)}
                />
                Student cancels late
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noShowEarns}
                  onChange={(e) => setNoShowEarns(e.target.checked)}
                />
                No-show
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teacherEarns}
                  onChange={(e) => setTeacherEarns(e.target.checked)}
                />
                Teacher cancels
              </label>
            </div>
          </fieldset>

          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Make-up credits expire after (days)
            </span>
            <input
              type="number"
              min={1}
              placeholder="Never"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className={`${inputClass} w-full`}
            />
            <span className="block text-xs text-muted mt-1">
              Leave blank for no expiry.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving..." : "Save Policy"}
            </Button>
            {message && <span className="text-xs text-muted">{message}</span>}
          </div>
        </form>
      )}
    </Card>
  );
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Australia/Sydney",
  "Asia/Tokyo",
  "America/Tegucigalpa",
];
