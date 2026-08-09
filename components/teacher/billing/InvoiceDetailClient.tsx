"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  centsToDollarsInput,
  dollarsToCents,
  formatMoney,
} from "@/lib/billing";
import { InvoiceStatusBadge } from "@/components/teacher/billing/BillingList";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

const amountInputClass =
  "w-[5.5rem] px-2 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm tabular-nums";

interface LineItem {
  id?: string;
  lessonId?: string | null;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
}

export function InvoiceDetailClient({
  invoiceId,
  status,
  currency,
  initialItems,
  initialNotes,
  familyName,
  periodStart,
  periodEnd,
  subtotalCents,
  paymentProvider,
  stripeConfigured,
  checkoutUrl,
  paymentInstructions,
  payments = [],
}: {
  invoiceId: string;
  status: string;
  currency: string;
  initialItems: LineItem[];
  initialNotes: string;
  familyName: string;
  periodStart: string;
  periodEnd: string;
  subtotalCents: number;
  paymentProvider: "manual" | "stripe";
  stripeConfigured: boolean;
  checkoutUrl: string | null;
  paymentInstructions: string;
  payments?: {
    id: string;
    amountCents: number;
    method: string;
    note: string;
    recordedAt: string;
  }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState(initialItems);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isDraft = status === "draft";

  // Re-sync local edits when the server payload changes (router.refresh after
  // save/send) — the sanctioned adjust-state-during-render pattern.
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  if (prevInitialItems !== initialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
    setNotes(initialNotes);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.unitCents !== undefined || patch.quantity !== undefined) {
          next.amountCents = next.unitCents * next.quantity;
        }
        return next;
      })
    );
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, notes }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Save failed");
    }
  }

  async function regenerate() {
    const ok = await confirm({
      title: "Regenerate line items?",
      message:
        "Replace line items with a fresh calculation from attendance and your current billing settings? Manual edits on this draft will be lost.",
      confirmLabel: "Regenerate",
    });
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/regenerate`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Regenerate failed");
      return;
    }
    setMessage(
      data.itemCount === 0
        ? "Regenerated — no billable lessons in this period"
        : `Regenerated ${data.itemCount} line${data.itemCount === 1 ? "" : "s"}`
    );
    router.refresh();
  }

  async function send() {
    const ok = await confirm({
      title: "Send invoice?",
      message:
        "Line items will be frozen and the family will be emailed a PDF.",
      confirmLabel: "Send",
    });
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    if (isDraft) {
      await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes }),
      });
    }
    const res = await fetch(`/api/billing/invoices/${invoiceId}/send`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Send failed");
      return;
    }
    setMessage(
      data.emailed
        ? "Sent and emailed"
        : data.emailError
          ? `Sent (${data.emailError})`
          : "Sent"
    );
    router.refresh();
  }

  async function markPaid() {
    setBusy(true);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed");
    }
  }

  async function voidInvoice() {
    const ok = await confirm({
      title: "Void invoice?",
      message:
        "Voiding cancels the charge, so the family should not pay it. Paid invoices cannot be voided (use a refund outside CogNote if needed).",
      confirmLabel: "Void",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/void`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed");
    }
  }

  async function createCheckout() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/checkout`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Checkout failed");
      return;
    }
    if (data.url) {
      await navigator.clipboard.writeText(data.url).catch(() => {});
      setMessage("Pay link copied to clipboard");
      router.refresh();
    }
  }

  const liveTotal = items.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{familyName}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted">
            {periodStart} → {periodEnd} ·{" "}
            {formatMoney(isDraft ? liveTotal : subtotalCents, currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={regenerate}
                disabled={busy}
              >
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={saveDraft}
                disabled={busy}
              >
                Save draft
              </Button>
              <Button size="sm" onClick={send} disabled={busy}>
                Send
              </Button>
            </>
          )}
          {(status === "sent" || status === "draft") && (
            <Button
              size="sm"
              variant="secondary"
              onClick={markPaid}
              disabled={busy}
            >
              Mark paid
            </Button>
          )}
          {status === "sent" &&
            paymentProvider === "stripe" &&
            stripeConfigured && (
              <Button size="sm" onClick={createCheckout} disabled={busy}>
                {checkoutUrl ? "Copy pay link" : "Create pay link"}
              </Button>
            )}
          {status !== "paid" && status !== "void" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={voidInvoice}
              disabled={busy}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}

      {checkoutUrl && status === "sent" && (
        <Card padding="sm">
          <div className="text-xs font-semibold text-muted mb-1">
            Stripe pay link
          </div>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary font-medium hover:underline"
          >
            Pay online
          </a>
        </Card>
      )}

      <Card padding="sm">
        <h2 className="font-semibold mb-3">Line items</h2>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id ?? index}
              className="flex flex-col gap-2 sm:flex-row sm:items-center border-b border-border last:border-0 pb-3 last:pb-0"
            >
              {isDraft ? (
                <>
                  <input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    className={`${inputClass} w-full sm:flex-1 sm:min-w-0`}
                  />
                  <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                    <label className="flex items-center gap-1.5">
                      <span className="text-sm text-muted">$</span>
                      <input
                        value={centsToDollarsInput(item.unitCents)}
                        onChange={(e) => {
                          const cents = dollarsToCents(e.target.value);
                          if (cents !== null) {
                            updateItem(index, { unitCents: cents });
                          }
                        }}
                        className={amountInputClass}
                        aria-label="Line amount"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-sm text-error hover:underline cursor-pointer px-1"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm flex-1 min-w-0">{item.description}</div>
                  <div className="text-sm font-medium tabular-nums shrink-0">
                    {formatMoney(item.amountCents, currency)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {isDraft && (
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                {
                  description: "Custom line",
                  quantity: 1,
                  unitCents: 0,
                  amountCents: 0,
                },
              ])
            }
            className="mt-3 text-sm text-primary hover:underline cursor-pointer"
          >
            + Add line
          </button>
        )}
        <div className="mt-4 pt-3 border-t border-border flex justify-between font-semibold">
          <span>Total</span>
          <span>
            {formatMoney(isDraft ? liveTotal : subtotalCents, currency)}
          </span>
        </div>
      </Card>

      <Card padding="sm">
        <h2 className="font-semibold mb-2">Notes</h2>
        {isDraft ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} w-full resize-y`}
            placeholder="Optional note on the invoice"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap text-muted">
            {notes || "—"}
          </p>
        )}
      </Card>

      {payments.length > 0 && (
        <Card padding="sm">
          <h2 className="font-semibold mb-2">Payments</h2>
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <div>
                  <span className="font-medium capitalize">{p.method}</span>
                  {p.note ? (
                    <span className="text-muted"> · {p.note}</span>
                  ) : null}
                  <div className="text-xs text-muted">
                    {new Date(p.recordedAt).toLocaleString()}
                  </div>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatMoney(p.amountCents, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {paymentProvider === "manual" && paymentInstructions && (
        <Card padding="sm">
          <h2 className="font-semibold mb-2">Payment instructions</h2>
          <p className="text-sm whitespace-pre-wrap text-muted">
            {paymentInstructions}
          </p>
        </Card>
      )}
    </div>
  );
}
