import { formatMoney } from "@/lib/billing";
import { escapeHtml } from "@/lib/html";

export interface InvoiceReminderInput {
  familyGreeting: string;
  studioName: string;
  periodStart: string;
  periodEnd: string;
  /** What is still owed (subtotal minus payments). Always > 0. */
  balanceCents: number;
  currency: string;
  daysLate: number;
  /** Fresh Checkout link when the studio is on Stripe; null for manual. */
  payUrl: string | null;
  paymentInstructions: string;
  portalUrl: string;
}

export interface InvoiceReminderEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * A short, friendly nudge. Deliberately not the invoice email: no PDF, no
 * line items — just what is owed, how late it is, and how to pay it.
 */
export function buildInvoiceReminderEmail(
  input: InvoiceReminderInput
): InvoiceReminderEmail {
  const period = `${input.periodStart} to ${input.periodEnd}`;
  const total = formatMoney(input.balanceCents, input.currency);
  const studio = input.studioName.trim() || "your studio";
  const late = `${input.daysLate} day${input.daysLate === 1 ? "" : "s"}`;

  const payText = input.payUrl
    ? `Pay online: ${input.payUrl}`
    : [input.paymentInstructions.trim(), `Your family portal: ${input.portalUrl}`]
        .filter(Boolean)
        .join("\n\n");

  const instructions = input.paymentInstructions.trim();

  const payHtml = input.payUrl
    ? `<p><a href="${escapeHtml(input.payUrl)}">Pay online</a></p>`
    : [
        instructions
          ? `<p style="white-space:pre-wrap;">${escapeHtml(instructions)}</p>`
          : "",
        `<p><a href="${escapeHtml(input.portalUrl)}">Open your family portal</a></p>`,
      ]
        .filter(Boolean)
        .join("\n");

  const text = `Hi ${input.familyGreeting},\n\nA quick reminder about your invoice for ${period}: ${total} is still outstanding, ${late} past due.\n\n${payText}\n\nIf you have already paid, please ignore this note.\n\n— ${studio} (sent via CogNote Studio)`;

  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;color:#222;">
<p>Hi ${escapeHtml(input.familyGreeting)},</p>
<p>A quick reminder about your invoice for ${escapeHtml(period)}: <strong>${escapeHtml(total)}</strong> is still outstanding, ${escapeHtml(late)} past due.</p>
${payHtml}
<p>If you have already paid, please ignore this note.</p>
<p>— ${escapeHtml(studio)} (sent via CogNote Studio)</p>
</div>`;

  return {
    subject: `Reminder: invoice for ${period} - ${studio}`,
    text,
    html,
  };
}
