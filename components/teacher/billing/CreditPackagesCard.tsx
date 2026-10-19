"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  centsToDollarsInput,
  dollarsToCents,
  formatCalendarDate,
  formatMoney,
  resolveLessonCharge,
  type RateSources,
} from "@/lib/billing";
import {
  describeCreditPackage,
  type CreditPackageState,
} from "@/lib/credits";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export interface CreditPackageView {
  id: string;
  invoiceId: string;
  credits: number;
  durationMinutes: number;
  priceCents: number;
  startsOn: string;
  expiresOn: string | null;
  usedCredits: number;
  pendingCredits: number;
  remainingCredits: number;
  state: CreditPackageState;
  redemptions: { id: string; lessonDate: string | null }[];
}

const STATE_LABELS: Record<CreditPackageState, { text: string; className: string }> = {
  pending: { text: "Invoice not sent", className: "bg-warning/20 text-foreground" },
  active: { text: "Active", className: "bg-success/15 text-success" },
  used_up: { text: "Used up", className: "bg-surface-dim text-muted" },
  expired: { text: "Expired", className: "bg-surface-dim text-muted" },
};

/**
 * Prepaid lesson credits on the student page: balances, the lessons that used
 * them, and selling a new package (a draft invoice for the family).
 */
export function CreditPackagesCard({
  studentId,
  hasFamily,
  currency,
  packages,
  defaultDurationMinutes,
  rate,
  durationRates,
  rateBasis,
}: {
  studentId: string;
  hasFamily: boolean;
  currency: string;
  packages: CreditPackageView[];
  defaultDurationMinutes: number;
  /** For the suggested price: what one lesson would bill at today. */
  rate: Omit<RateSources, "durationRateCents">;
  durationRates: Record<number, number>;
  rateBasis: "per_lesson" | "per_hour";
}) {
  const [selling, setSelling] = useState(false);
  const live = packages.filter((p) => p.state === "active");
  const totalLeft = live.reduce((sum, p) => sum + p.remainingCredits, 0);

  return (
    <Card padding="sm" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold">Prepaid lessons</h3>
          <p className="text-xs text-muted">
            {live.length > 0
              ? `${totalLeft} credit${totalLeft === 1 ? "" : "s"} left. Billable lessons of a package's length use a credit instead of being invoiced.`
              : "Sell a package of lessons up front. Billable lessons use a credit instead of being invoiced, and bill as usual once credits run out."}
          </p>
        </div>
        {!selling && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelling(true)}
            disabled={!hasFamily}
            title={hasFamily ? undefined : "Link a family first"}
          >
            Sell package
          </Button>
        )}
      </div>

      {selling && (
        <SellPackageForm
          studentId={studentId}
          currency={currency}
          defaultDurationMinutes={defaultDurationMinutes}
          rate={rate}
          durationRates={durationRates}
          rateBasis={rateBasis}
          onCancel={() => setSelling(false)}
        />
      )}

      {packages.length > 0 && (
        <div className="space-y-2 mt-3">
          {packages.map((pkg) => (
            <PackageRow key={pkg.id} pkg={pkg} currency={currency} />
          ))}
        </div>
      )}
    </Card>
  );
}

function PackageRow({
  pkg,
  currency,
}: {
  pkg: CreditPackageView;
  currency: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showUsed, setShowUsed] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiry, setExpiry] = useState(pkg.expiresOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = STATE_LABELS[pkg.state];

  async function saveExpiry() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/billing/credit-packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresOn: expiry || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save the expiry date");
      return;
    }
    setEditingExpiry(false);
    router.refresh();
  }

  async function returnCredit(redemptionId: string, lessonDate: string | null) {
    const ok = await confirm({
      title: "Return this credit?",
      message: `The ${lessonDate ? formatCalendarDate(lessonDate) : ""} lesson goes back to unbilled. The next invoice run bills it, or covers it with a credit again, under its current attendance.`,
      confirmLabel: "Return credit",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/billing/credit-redemptions/${redemptionId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't return the credit");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border border-border rounded-lg p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium flex flex-wrap items-center gap-2">
            {describeCreditPackage(pkg.credits, pkg.durationMinutes)}
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.text}
            </span>
          </div>
          <div className="text-xs text-muted mt-0.5">
            {formatMoney(pkg.priceCents, currency)} · from{" "}
            {formatCalendarDate(pkg.startsOn)} ·{" "}
            {pkg.expiresOn
              ? `expires ${formatCalendarDate(pkg.expiresOn)}`
              : "no expiry"}{" "}
            ·{" "}
            <Link
              href={`/billing/${pkg.invoiceId}`}
              className="text-primary hover:underline"
            >
              Invoice
            </Link>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold tabular-nums">
            {pkg.remainingCredits}
            <span className="text-sm font-normal text-muted">
              {" "}
              / {pkg.credits} left
            </span>
          </div>
          {pkg.pendingCredits > 0 && (
            <div className="text-xs text-muted">
              {pkg.pendingCredits} marked, not yet billed
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
        {editingExpiry ? (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={expiry}
              min={pkg.startsOn}
              onChange={(e) => setExpiry(e.target.value)}
              className={inputClass}
              aria-label="Expiry date"
            />
            <Button size="sm" onClick={saveExpiry} disabled={busy}>
              Save
            </Button>
            <button
              type="button"
              onClick={() => {
                setExpiry(pkg.expiresOn ?? "");
                setEditingExpiry(false);
              }}
              className="text-muted hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-muted">Leave blank for no expiry.</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditingExpiry(true)}
            className="text-primary hover:underline cursor-pointer"
          >
            Change expiry
          </button>
        )}
        {pkg.redemptions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUsed((v) => !v)}
            className="text-primary hover:underline cursor-pointer"
          >
            {showUsed ? "Hide" : "Show"} {pkg.redemptions.length} used
          </button>
        )}
      </div>

      {showUsed && (
        <ul className="mt-2 space-y-1">
          {pkg.redemptions.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>
                {r.lessonDate ? formatCalendarDate(r.lessonDate) : "Lesson"}
              </span>
              <button
                type="button"
                onClick={() => returnCredit(r.id, r.lessonDate)}
                disabled={busy}
                className="text-error hover:underline cursor-pointer disabled:opacity-50"
              >
                Return credit
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-error text-xs mt-2">{error}</p>}
    </div>
  );
}

function SellPackageForm({
  studentId,
  currency,
  defaultDurationMinutes,
  rate,
  durationRates,
  rateBasis,
  onCancel,
}: {
  studentId: string;
  currency: string;
  defaultDurationMinutes: number;
  rate: Omit<RateSources, "durationRateCents">;
  durationRates: Record<number, number>;
  rateBasis: "per_lesson" | "per_hour";
  onCancel: () => void;
}) {
  const router = useRouter();

  function suggestedPrice(credits: number, durationMinutes: number): string {
    const charge = resolveLessonCharge(
      { ...rate, durationRateCents: durationRates[durationMinutes] ?? null },
      durationMinutes,
      rateBasis
    );
    return charge.missingRate
      ? ""
      : centsToDollarsInput(charge.amountCents * credits);
  }

  const [credits, setCredits] = useState("10");
  const [duration, setDuration] = useState(String(defaultDurationMinutes));
  const [price, setPrice] = useState(
    suggestedPrice(10, defaultDurationMinutes)
  );
  const [priceEdited, setPriceEdited] = useState(false);
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSuggestion(nextCredits: string, nextDuration: string) {
    if (priceEdited) return;
    const c = Number(nextCredits);
    const d = Number(nextDuration);
    if (Number.isInteger(c) && c > 0 && Number.isInteger(d) && d > 0) {
      setPrice(suggestedPrice(c, d));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = dollarsToCents(price);
    if (priceCents == null) {
      setError("Enter a package price");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/credit-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        credits: Number(credits),
        durationMinutes: Number(duration),
        priceCents,
        expiresOn: expiresOn || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't create the package");
      return;
    }
    router.push(`/billing/${data.invoiceId}`);
  }

  return (
    <form
      onSubmit={submit}
      className="border border-border rounded-lg p-3 mt-2 space-y-3"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Lessons
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={credits}
            onChange={(e) => {
              setCredits(e.target.value);
              updateSuggestion(e.target.value, duration);
            }}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Length (min)
          </span>
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              updateSuggestion(credits, e.target.value);
            }}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Price ({currency})
          </span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceEdited(true);
            }}
            placeholder="0.00"
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Expires (optional)
          </span>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Creates a draft invoice for the family. Credits can be used once you
        send it or mark it paid, and cover {duration || "?"}-min lessons from
        today on.
      </p>
      {error && <p className="text-error text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create invoice"}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
