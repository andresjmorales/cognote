import { Card } from "@/components/ui/card";
import {
  agingBuckets,
  formatMoney,
  type AgingBucketKey,
  type AgingInvoice,
} from "@/lib/billing";

const BUCKETS: { key: AgingBucketKey; label: string }[] = [
  { key: "current", label: "Not yet due" },
  { key: "overdue1to14", label: "1–14 days late" },
  { key: "overdue15to30", label: "15–30 days late" },
  { key: "overdue31plus", label: "31+ days late" },
];

/**
 * Outstanding balance by age. Formatting only: the aging rules (which statuses
 * count, how balances split into buckets) live in `lib/billing.ts`.
 */
export function ReceivablesCard({
  invoices,
  termsDays,
  currency,
  now,
  remindersEnabled,
}: {
  invoices: AgingInvoice[];
  termsDays: number;
  currency: string;
  now: Date;
  remindersEnabled: boolean;
}) {
  const { buckets, totalCents, overdueCents } = agingBuckets(
    invoices,
    termsDays,
    now
  );

  if (totalCents <= 0) {
    return (
      <Card padding="sm" className="mb-4">
        <h2 className="font-semibold mb-1">Outstanding</h2>
        <p className="text-sm text-muted">No outstanding invoices.</p>
      </Card>
    );
  }

  return (
    <Card padding="sm" className="mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-3">
        <h2 className="font-semibold">Outstanding</h2>
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">
            {formatMoney(totalCents, currency)}
          </span>{" "}
          owed
          {overdueCents > 0 && (
            <>
              {" · "}
              <span className="text-error font-semibold">
                {formatMoney(overdueCents, currency)} overdue
              </span>
            </>
          )}
        </p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKETS.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd
              className={`text-sm mt-0.5 ${key === "current" ? "" : "text-error"}`}
            >
              {formatMoney(buckets[key].cents, currency)}
            </dd>
          </div>
        ))}
      </dl>
      {remindersEnabled && (
        <p className="text-xs text-muted mt-3">
          One reminder email goes out once an invoice is more than{" "}
          {termsDays === 1 ? "1 day" : `${termsDays} days`} old.
        </p>
      )}
    </Card>
  );
}
