"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy, PaymentProvider } from "@/lib/schedule";
import type { StripeKeyStatus } from "@/lib/billing";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export type { StripeKeyStatus };

export function PaymentsSettingsForm({
  policy,
  teacherId,
  stripeStatus,
  embedded = false,
}: {
  policy: StudioPolicy;
  teacherId: string;
  stripeStatus: StripeKeyStatus;
  /** When true, skip outer Card/h2 (used inside Billing payment settings modal). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [provider, setProvider] = useState<PaymentProvider>(
    policy.payment_provider
  );
  const [instructions, setInstructions] = useState(policy.payment_instructions);
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearSecret, setClearSecret] = useState(false);
  const [clearPublishable, setClearPublishable] = useState(false);
  const [clearWebhook, setClearWebhook] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-host";
  const webhookUrl = `${origin}/api/webhooks/stripe/${teacherId}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentProvider: provider,
        paymentInstructions: instructions,
        ...(secretKey.trim() && { stripeSecretKey: secretKey.trim() }),
        ...(publishableKey.trim() && {
          stripePublishableKey: publishableKey.trim(),
        }),
        ...(webhookSecret.trim() && {
          stripeWebhookSecret: webhookSecret.trim(),
        }),
        ...(clearSecret && { clearStripeSecretKey: true }),
        ...(clearPublishable && { clearStripePublishableKey: true }),
        ...(clearWebhook && { clearStripeWebhookSecret: true }),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      setSecretKey("");
      setPublishableKey("");
      setWebhookSecret("");
      setClearSecret(false);
      setClearPublishable(false);
      setClearWebhook(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  const form = (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-1">
          Payment provider
        </legend>
        <div className="space-y-1.5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentProvider"
              checked={provider === "manual"}
              onChange={() => setProvider("manual")}
            />
            Manual (Zelle, Venmo, cash; mark paid yourself)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentProvider"
              checked={provider === "stripe"}
              onChange={() => setProvider("stripe")}
            />
            Stripe (bring your own keys)
          </label>
        </div>
      </fieldset>

      <label className="text-sm">
        <span className="block text-xs font-semibold text-muted mb-1">
          Payment instructions
        </span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Zelle to you@email.com · Venmo @yourstudio · cash at lesson"
          rows={3}
          maxLength={2000}
          className={`${inputClass} w-full resize-y`}
        />
        <span className="block text-xs text-muted mt-1">
          Shown on invoices and the family portal when using manual payments.
        </span>
      </label>

      {provider === "stripe" && (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            Paste keys from your Stripe Dashboard (Developers → API keys).
            Register the webhook URL below for{" "}
            <code className="text-[11px]">checkout.session.completed</code>,
            then paste the signing secret. Keys stay in your database and are
            never returned to the browser in full.
          </p>

          <KeyField
            label="Secret key"
            placeholder={
              stripeStatus.secretConfigured
                ? stripeStatus.secretMasked ?? "••••••••"
                : "sk_test_…"
            }
            value={secretKey}
            onChange={setSecretKey}
            configured={stripeStatus.secretConfigured}
            clear={clearSecret}
            onClearChange={setClearSecret}
          />
          <KeyField
            label="Publishable key"
            placeholder={
              stripeStatus.publishableConfigured
                ? stripeStatus.publishableMasked ?? "••••••••"
                : "pk_test_…"
            }
            value={publishableKey}
            onChange={setPublishableKey}
            configured={stripeStatus.publishableConfigured}
            clear={clearPublishable}
            onClearChange={setClearPublishable}
          />
          <KeyField
            label="Webhook signing secret"
            placeholder={
              stripeStatus.webhookConfigured
                ? stripeStatus.webhookMasked ?? "••••••••"
                : "whsec_…"
            }
            value={webhookSecret}
            onChange={setWebhookSecret}
            configured={stripeStatus.webhookConfigured}
            clear={clearWebhook}
            onClearChange={setClearWebhook}
          />

          <div className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Webhook endpoint
            </span>
            <code className="block text-xs bg-surface-dim px-2 py-2 rounded break-all">
              {webhookUrl}
            </code>
            <span className="block text-xs text-muted mt-1">
              In Stripe → Developers → Webhooks, add this URL and listen for{" "}
              <code className="text-[11px]">checkout.session.completed</code>.
              Your teacher id is{" "}
              <code className="text-[11px]">{teacherId}</code>.
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving..." : "Save payment settings"}
        </Button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </form>
  );

  if (embedded) return form;

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Payments</h2>
      {form}
    </Card>
  );
}

function KeyField({
  label,
  placeholder,
  value,
  onChange,
  configured,
  clear,
  onClearChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  configured: boolean;
  clear: boolean;
  onClearChange: (v: boolean) => void;
}) {
  return (
    <label className="text-sm block">
      <span className="block text-xs font-semibold text-muted mb-1">
        {label}
        {configured && !clear && (
          <span className="ml-2 font-normal text-success">configured</span>
        )}
      </span>
      <input
        type="password"
        autoComplete="off"
        value={clear ? "" : value}
        onChange={(e) => {
          onChange(e.target.value);
          if (clear) onClearChange(false);
        }}
        placeholder={clear ? "(will clear on save)" : placeholder}
        disabled={clear}
        className={`${inputClass} w-full font-mono`}
      />
      {configured && (
        <label className="flex items-center gap-2 mt-1 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={clear}
            onChange={(e) => {
              onClearChange(e.target.checked);
              if (e.target.checked) onChange("");
            }}
          />
          Clear saved {label.toLowerCase()}
        </label>
      )}
    </label>
  );
}
