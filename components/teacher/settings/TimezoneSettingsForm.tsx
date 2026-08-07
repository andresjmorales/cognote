"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timezoneSelectOptions } from "@/lib/timezones";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function TimezoneSettingsForm({
  timezone,
  embedded = false,
}: {
  timezone: string;
  /** When true, render form only (no Card / section heading). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const options = timezoneSelectOptions(timezone);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: value }),
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

  const form = (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <label className="text-sm">
        <span className="block text-xs font-semibold text-muted mb-1">
          Studio timezone
        </span>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${inputClass} w-full`}
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>
      {embedded && (
        <p className="text-xs text-muted -mt-1">
          Schedule times, make-up windows, and streaks use this zone.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy || value === timezone}>
          {busy ? "Saving..." : "Save timezone"}
        </Button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </form>
  );

  if (embedded) return form;

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-1">Timezone</h2>
      <p className="text-sm text-muted mb-3">
        Studio schedule times, make-up windows, and streaks use this zone.
      </p>
      {form}
    </Card>
  );
}
