"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { centsToDollarsInput, dollarsToCents, formatMoney } from "@/lib/billing";

/**
 * Editable student details: level, birthday, and optional default lesson rate.
 */
export function StudentInfoCard({
  studentId,
  initialLevel,
  initialBirthdate,
  initialDefaultRateCents,
}: {
  studentId: string;
  initialLevel: string | null;
  initialBirthdate: string | null;
  initialDefaultRateCents: number | null;
}) {
  return (
    <Card padding="sm" className="mb-6">
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <InfoField
          studentId={studentId}
          label="Level"
          field="level"
          type="text"
          initialValue={initialLevel}
          placeholder="e.g. RCM Level 3, Faber 2B"
          emptyLabel="Set level"
          display={(v) => v}
        />
        <InfoField
          studentId={studentId}
          label="Birthday"
          field="birthdate"
          type="date"
          initialValue={initialBirthdate}
          emptyLabel="Set birthday"
          display={(v) => {
            const age = ageFromBirthdate(v);
            return age !== null
              ? `${formatBirthdate(v)} (age ${age})`
              : formatBirthdate(v);
          }}
        />
        <RateField
          studentId={studentId}
          initialCents={initialDefaultRateCents}
        />
      </div>
    </Card>
  );
}

function RateField({
  studentId,
  initialCents,
}: {
  studentId: string;
  initialCents: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(centsToDollarsInput(initialCents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const cents =
      value.trim() === "" ? null : dollarsToCents(value);
    if (value.trim() !== "" && cents === null) {
      setError("Invalid amount");
      return;
    }
    setSaving(true);
    setError(null);
    await fetch(`/api/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultRateCents: cents }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <div className="text-xs text-muted font-medium mb-0.5">
        Default lesson rate
      </div>
      {editing ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-sm text-muted">$</span>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="45.00"
            className="px-2 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm w-24"
          />
          <button
            onClick={save}
            disabled={saving}
            className="text-xs text-primary hover:text-primary-dark font-semibold cursor-pointer"
          >
            {saving ? "..." : "Save"}
          </button>
          {error && <span className="text-xs text-error">{error}</span>}
        </span>
      ) : (
        <button
          onClick={() => {
            setValue(centsToDollarsInput(initialCents));
            setEditing(true);
          }}
          className="text-sm hover:text-primary transition-colors cursor-pointer"
          title="Edit default lesson rate"
        >
          {initialCents != null ? (
            <span className="font-medium">{formatMoney(initialCents)}</span>
          ) : (
            <span className="text-muted">Set rate</span>
          )}
        </button>
      )}
    </div>
  );
}

function InfoField({
  studentId,
  label,
  field,
  type,
  initialValue,
  placeholder,
  emptyLabel,
  display,
}: {
  studentId: string;
  label: string;
  field: "level" | "birthdate";
  type: "text" | "date";
  initialValue: string | null;
  placeholder?: string;
  emptyLabel: string;
  display: (value: string) => string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <div className="text-xs text-muted font-medium mb-0.5">{label}</div>
      {editing ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            autoFocus
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder={placeholder}
            className="px-2 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm w-44"
          />
          <button
            onClick={save}
            disabled={saving}
            className="text-xs text-primary hover:text-primary-dark font-semibold cursor-pointer"
          >
            {saving ? "..." : "Save"}
          </button>
        </span>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm hover:text-primary transition-colors cursor-pointer"
          title={`Edit ${label.toLowerCase()}`}
        >
          {initialValue ? (
            <span className="font-medium">{display(initialValue)}</span>
          ) : (
            <span className="text-muted">{emptyLabel}</span>
          )}
        </button>
      )}
    </div>
  );
}

/** Parse a YYYY-MM-DD date string as local date parts (avoids UTC shifting). */
function parseDateParts(dateString: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function ageFromBirthdate(birthdate: string): number | null {
  const parts = parseDateParts(birthdate);
  if (!parts) return null;
  const [year, month, day] = parts;
  const now = new Date();
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthdayThisYear) age--;
  return age >= 0 && age < 130 ? age : null;
}

function formatBirthdate(birthdate: string): string {
  const parts = parseDateParts(birthdate);
  if (!parts) return birthdate;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
