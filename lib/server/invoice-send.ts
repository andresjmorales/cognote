import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { loadInvoicePdf } from "@/lib/server/invoice-pdf-data";
import { isValidPaymentQrDataUrl } from "@/lib/payment-qr";
import { formatMoney } from "@/lib/billing";
import { createCheckoutSession } from "@/lib/payments";
import {
  familyEmailRecipients,
  familyDisplayName,
  familyGreetingNames,
  stripeCheckoutPrefillEmail,
} from "@/lib/guardians";

export interface SendInvoiceResult {
  ok: boolean;
  error?: string;
  emailed?: boolean;
  emailError?: string;
  checkoutUrl?: string | null;
  /** Set when Stripe Checkout was attempted but failed; send still succeeds. */
  checkoutError?: string;
}

/**
 * Freeze a draft invoice and email the PDF. Shared by single-send and bulk.
 */
export async function sendInvoice(
  supabase: SupabaseClient,
  opts: {
    invoiceId: string;
    teacherId: string;
    teacherEmail?: string | null;
    origin: string;
  }
): Promise<SendInvoiceResult> {
  const { invoiceId: id, teacherId, teacherEmail, origin } = opts;

  const loaded = await loadInvoicePdf(supabase, {
    invoiceId: id,
    teacherId,
    requireDraft: true,
  });

  if (!loaded.ok) {
    switch (loaded.code) {
      case "not_found":
        return { ok: false, error: "Not found" };
      case "not_draft":
        return { ok: false, error: "Only draft invoices can be sent" };
      case "no_items":
        return { ok: false, error: "Add at least one line item before sending" };
      case "no_family":
        return { ok: false, error: "Family not found" };
      case "pdf_failed":
        return {
          ok: false,
          error:
            "Could not build the invoice PDF. Try removing emoji from names or notes.",
        };
    }
  }

  const { invoice, family, policy, pdfBytes } = loaded.data;
  const familyName = familyDisplayName(family);

  let checkoutUrl: string | null = invoice.stripe_checkout_url;
  let checkoutError: string | undefined;

  if (
    policy.payment_provider === "stripe" &&
    policy.stripe_secret_key &&
    invoice.subtotal_cents > 0 &&
    !checkoutUrl
  ) {
    try {
      const session = await createCheckoutSession({
        secretKey: policy.stripe_secret_key,
        invoiceId: id,
        teacherId,
        amountCents: invoice.subtotal_cents,
        currency: invoice.currency,
        familyName,
        studioName: policy.studio_name,
        periodLabel: `${invoice.period_start} – ${invoice.period_end}`,
        successUrl: `${origin}/portal/${family.portal_token}?paid=1`,
        cancelUrl: `${origin}/portal/${family.portal_token}`,
        customerEmail: stripeCheckoutPrefillEmail(family),
      });
      checkoutUrl = session.url;
      await supabase
        .from("invoices")
        .update({
          stripe_checkout_session_id: session.sessionId,
          stripe_checkout_url: session.url,
        })
        .eq("id", id)
        .eq("teacher_id", teacherId);
    } catch (err) {
      console.error(
        "Stripe checkout on send failed:",
        err instanceof Error ? err.message : err
      );
      checkoutError =
        "Pay link could not be created. Use Create pay link to try again";
    }
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .eq("status", "draft");

  if (updateError) return { ok: false, error: updateError.message };

  const recipients = familyEmailRecipients(family);
  let emailed = false;
  let emailError: string | undefined;

  if (recipients.length === 0) {
    emailError =
      "No family email on file; invoice marked sent for the portal";
  } else {
    const periodLabel = `${invoice.period_start} to ${invoice.period_end}`;
    const studio = policy.studio_name || "your studio";
    const total = formatMoney(invoice.subtotal_cents, invoice.currency);
    const greeting = familyGreetingNames(family);

    const qrNote =
      !checkoutUrl &&
      policy.payment_provider === "manual" &&
      isValidPaymentQrDataUrl(policy.payment_qr_code)
        ? "A payment QR code is included on the attached invoice."
        : "";

    const payText = checkoutUrl
      ? `Pay online: ${checkoutUrl}`
      : policy.payment_instructions.trim()
        ? `Payment instructions:\n${policy.payment_instructions.trim()}${qrNote ? `\n\n${qrNote}` : ""}`
        : qrNote || "See your family portal for payment details.";

    const payHtml = checkoutUrl
      ? `<p><a href="${escapeHtml(checkoutUrl)}">Pay online</a></p>`
      : policy.payment_instructions.trim()
        ? `<p><strong>Payment instructions</strong></p><p style="white-space:pre-wrap;">${escapeHtml(policy.payment_instructions.trim())}</p>${qrNote ? `<p>${qrNote}</p>` : ""}`
        : `<p>${qrNote || "See your family portal for payment details."}</p>`;

    const text = `Hi ${greeting},\n\nPlease find attached your invoice for ${periodLabel}.\n\nTotal due: ${total}\n\n${payText}\n\n— ${studio} (sent via CogNote Studio)`;

    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;color:#222;">
<p>Hi ${escapeHtml(greeting)},</p>
<p>Please find attached your invoice for ${escapeHtml(periodLabel)}.</p>
<p><strong>Total due: ${escapeHtml(total)}</strong></p>
${payHtml}
<p>— ${escapeHtml(studio)} (sent via CogNote Studio)</p>
</div>`;

    const result = await sendEmail({
      to: recipients,
      subject: `Invoice for ${periodLabel} - ${studio}`,
      text,
      html,
      fromName: policy.studio_name
        ? `${policy.studio_name} (via CogNote)`
        : undefined,
      replyTo: teacherEmail ?? undefined,
      portalUrl: family.portal_token
        ? `${origin}/portal/${family.portal_token}`
        : undefined,
      attachments: [
        {
          filename: `invoice-${invoice.period_start}.pdf`,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });
    emailed = result.sent;
    emailError = result.error;
  }

  return { ok: true, emailed, emailError, checkoutUrl, checkoutError };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
