"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy, PaymentProvider } from "@/lib/schedule";
import {
  validateLiveStripeKeys,
  type StripeKeyStatus,
} from "@/lib/billing";
import {
  PAYMENT_QR_ACCEPT,
  PAYMENT_QR_MAX_DATA_URL_LENGTH,
  PAYMENT_QR_MAX_DIMENSION,
  PAYMENT_QR_MAX_INPUT_BYTES,
} from "@/lib/payment-qr";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export type { StripeKeyStatus };

export function PaymentsSettingsForm({
  policy,
  teacherId,
  stripeStatus,
  embedded = false,
  onSaved,
}: {
  policy: StudioPolicy;
  teacherId: string;
  stripeStatus: StripeKeyStatus;
  /** When true, skip outer Card/h2 (used inside Billing payment settings modal). */
  embedded?: boolean;
  /** Called after a successful save (e.g. close the Billing modal). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [provider, setProvider] = useState<PaymentProvider>(
    policy.payment_provider
  );
  const [instructions, setInstructions] = useState(policy.payment_instructions);
  const [qrCode, setQrCode] = useState<string | null>(policy.payment_qr_code);
  const [qrDirty, setQrDirty] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clearSecret, setClearSecret] = useState(false);
  const [clearPublishable, setClearPublishable] = useState(false);
  const [clearWebhook, setClearWebhook] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-host";
  const webhookUrl = `${origin}/api/webhooks/stripe/${teacherId}`;

  async function onQrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setQrError(null);
    if (!file.type.startsWith("image/")) {
      setQrError("Choose an image file");
      return;
    }
    if (file.size > PAYMENT_QR_MAX_INPUT_BYTES) {
      setQrError("Image must be under 8 MB");
      return;
    }
    try {
      setQrCode(await qrImageToDataUrl(file));
      setQrDirty(true);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    if (provider === "stripe") {
      const keyError = validateLiveStripeKeys({
        secretKey: secretKey.trim() || null,
        publishableKey: publishableKey.trim() || null,
      });
      if (keyError) {
        setBusy(false);
        setMessage(keyError);
        setTimeout(() => setMessage(null), 4000);
        return;
      }
    }

    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentProvider: provider,
        paymentInstructions: instructions,
        ...(qrDirty && { paymentQrCode: qrCode }),
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
      setQrDirty(false);
      router.refresh();
      onSaved?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
      setTimeout(() => setMessage(null), 2500);
    }
  }

  const saveRow = (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Saving..." : "Save payment settings"}
      </Button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );

  const fields = (
    <>
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

      {provider === "manual" && (
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
      )}

      {provider === "manual" && (
        <div className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Payment QR code (optional)
          </span>
          <div className="flex items-start gap-3">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="Payment QR code"
                className="h-28 w-28 rounded-lg border border-border bg-white object-contain p-1"
              />
            ) : (
              <div className="h-28 w-28 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted text-center px-2">
                No QR code
              </div>
            )}
            <div className="flex flex-col items-start gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => qrInputRef.current?.click()}
              >
                {qrCode ? "Replace image" : "Upload image"}
              </Button>
              {qrCode && (
                <button
                  type="button"
                  onClick={() => {
                    setQrCode(null);
                    setQrDirty(true);
                    setQrError(null);
                  }}
                  className="text-xs text-muted hover:text-foreground cursor-pointer"
                >
                  Remove
                </button>
              )}
              {qrError && <span className="text-xs text-error">{qrError}</span>}
            </div>
          </div>
          <input
            ref={qrInputRef}
            type="file"
            accept={PAYMENT_QR_ACCEPT}
            className="hidden"
            onChange={onQrFileChange}
          />
          <span className="block text-xs text-muted mt-1">
            e.g. PayNow, UPI, PIX, or Venmo. Added to invoice PDFs and shown in
            the family portal. Test-scan it after saving.
          </span>
        </div>
      )}

      {provider === "stripe" && (
        <div className="space-y-3 border-t border-border pt-3">
          <details className="rounded-lg border border-border bg-surface-dim/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-foreground select-none">
              How to set up Stripe
            </summary>
            <ol className="mt-2 list-decimal pl-5 space-y-2 text-xs text-muted leading-relaxed">
              <li>
                In Stripe, open <strong className="font-semibold text-foreground">Developers → API keys</strong>{" "}
                (live mode). Under <strong className="font-semibold text-foreground">Standard keys</strong>,
                copy the <strong className="font-semibold text-foreground">Secret key</strong>{" "}
                (<code className="text-[11px]">sk_live_…</code>) and{" "}
                <strong className="font-semibold text-foreground">Publishable key</strong>{" "}
                (<code className="text-[11px]">pk_live_…</code>). Do not use Restricted keys (
                <code className="text-[11px]">rk_…</code>) or test keys (
                <code className="text-[11px]">sk_test_…</code>).
              </li>
              <li>
                Open <strong className="font-semibold text-foreground">Workbench → Webhooks</strong>{" "}
                (or Developers → Webhooks), add an endpoint with the URL below, and
                subscribe only to{" "}
                <code className="text-[11px]">checkout.session.completed</code>.
                Paste the signing secret (<code className="text-[11px]">whsec_…</code>) here.
              </li>
              <li>
                If the webhook is missing or wrong, families can still pay (Stripe
                collects the money), but CogNote will not auto-mark the invoice paid.
                You can mark it paid manually on the invoice.
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted">
              More detail:{" "}
              <Link href="/help#billing-payments" className="text-primary hover:underline">
                Help → Billing &amp; Payments
              </Link>
              .
            </p>
          </details>

          <KeyField
            label="Standard secret key"
            placeholder={
              stripeStatus.secretConfigured
                ? stripeStatus.secretMasked ?? "••••••••"
                : "sk_live_…"
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
                : "pk_live_…"
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
              Webhook endpoint URL
            </span>
            <code className="block text-xs bg-surface-dim px-2 py-2 rounded break-all">
              {webhookUrl}
            </code>
            <span className="block text-xs text-muted mt-1">
              Listen for{" "}
              <code className="text-[11px]">checkout.session.completed</code> only.
              Keys stay in your database and are never returned to the browser in full.
            </span>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          {fields}
        </div>
        <div className="shrink-0 border-t border-border bg-surface px-5 py-3">
          {saveRow}
        </div>
      </form>
    );
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Payments</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {fields}
        {saveRow}
      </form>
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

/**
 * Downscale an uploaded QR image and re-encode it as a data URL small enough
 * to store on the policy. PNG keeps QR edges crisp; JPEG is the fallback for
 * photos of a QR code that PNG can't compress under the limit.
 */
async function qrImageToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = url;
    });
    const scale = Math.min(
      1,
      PAYMENT_QR_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    // White backdrop so transparent PNGs stay scannable (and JPEG-safe).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const png = canvas.toDataURL("image/png");
    if (png.length <= PAYMENT_QR_MAX_DATA_URL_LENGTH) return png;
    const jpeg = canvas.toDataURL("image/jpeg", 0.9);
    if (jpeg.length <= PAYMENT_QR_MAX_DATA_URL_LENGTH) return jpeg;
    throw new Error("Image is too detailed; crop it to just the QR code");
  } finally {
    URL.revokeObjectURL(url);
  }
}
