"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/billing";
import { InvoiceStatusBadge } from "@/components/teacher/billing/BillingList";

export interface InvoiceListRow {
  id: string;
  familyName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  subtotalCents: number;
  currency: string;
}

/**
 * Billing list with multi-select for the monthly send workflow.
 * Bulk Send = drafts only; Delete = draft/void; Void = draft/sent (not paid).
 */
export function InvoiceList({ invoices }: { invoices: InvoiceListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => invoices.filter((inv) => selected.has(inv.id)),
    [invoices, selected]
  );

  const allSelected =
    invoices.length > 0 && selected.size === invoices.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(invoices.map((i) => i.id)));
  }

  async function runBulk(action: "send" | "delete" | "void") {
    const actionable =
      action === "send"
        ? selectedRows.filter((r) => r.status === "draft")
        : action === "delete"
          ? selectedRows.filter(
              (r) => r.status === "draft" || r.status === "void"
            )
          : selectedRows.filter(
              (r) => r.status === "draft" || r.status === "sent"
            );

    if (actionable.length === 0) return;

    const ids = actionable.map((r) => r.id);
    const n = ids.length;
    const skipped = selected.size - n;

    const confirmMsg =
      action === "send"
        ? `Send ${n} draft invoice${n === 1 ? "" : "s"}? Families will be emailed a PDF.${
            skipped > 0 ? ` (${skipped} non-draft selected will be skipped.)` : ""
          }`
        : action === "delete"
          ? `Permanently delete ${n} draft/void invoice${n === 1 ? "" : "s"}?${
              skipped > 0
                ? ` (${skipped} sent/paid selected will be skipped.)`
                : ""
            }`
          : `Void ${n} unpaid invoice${n === 1 ? "" : "s"}? That cancels the charge — the family should not pay it, and those lessons can be billed again later.${
              skipped > 0
                ? ` (${skipped} paid/already-void selected will be skipped.)`
                : ""
            }`;

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/billing/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    const labels = { send: "Send", delete: "Delete", void: "Void" };
    if (!res.ok) {
      setMessage(data.error ?? `${labels[action]} failed`);
      return;
    }

    const failCount = data.failed?.length ?? 0;
    setMessage(
      failCount === 0
        ? `${labels[action]}: ${data.succeeded} succeeded`
        : `${labels[action]}: ${data.succeeded} succeeded, ${failCount} skipped/failed`
    );
    setSelected(new Set());
    router.refresh();
  }

  const draftSelected = selectedRows.filter((r) => r.status === "draft").length;
  const deletableSelected = selectedRows.filter(
    (r) => r.status === "draft" || r.status === "void"
  ).length;
  const voidableSelected = selectedRows.filter(
    (r) => r.status === "draft" || r.status === "sent"
  ).length;

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-border">
          <span className="text-sm text-muted mr-1">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            onClick={() => runBulk("send")}
            disabled={busy || draftSelected === 0}
            title="Sends draft invoices only"
          >
            Send drafts{draftSelected > 0 ? ` (${draftSelected})` : ""}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("void")}
            disabled={busy || voidableSelected === 0}
          >
            Void{voidableSelected > 0 ? ` (${voidableSelected})` : ""}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runBulk("delete")}
            disabled={busy || deletableSelected === 0}
            title="Deletes drafts and voided invoices only"
          >
            Delete{deletableSelected > 0 ? ` (${deletableSelected})` : ""}
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted hover:text-foreground cursor-pointer ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {message && <p className="text-sm text-muted mb-3">{message}</p>}

      <div className="flex items-center gap-3 py-2 px-1 border-b border-border text-xs text-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Select all invoices"
          className="cursor-pointer"
        />
        <span>Select all</span>
      </div>

      {invoices.map((inv) => {
        const checked = selected.has(inv.id);
        return (
          <div
            key={inv.id}
            className="flex items-center gap-3 py-3 px-1 border-b border-border last:border-0 hover:bg-surface-dim/50 transition-colors rounded"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(inv.id)}
              aria-label={`Select ${inv.familyName}`}
              className="cursor-pointer shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
            <Link
              href={`/billing/${inv.id}`}
              className="flex flex-1 items-center justify-between gap-3 min-w-0"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{inv.familyName}</div>
                <div className="text-xs text-muted">
                  {inv.periodStart} → {inv.periodEnd}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <InvoiceStatusBadge status={inv.status} />
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(inv.subtotalCents, inv.currency)}
                </span>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
