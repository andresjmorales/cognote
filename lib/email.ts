/**
 * Email provider interface (EMAIL_SETUP.md Part 4b, mirrors the payments
 * provider pattern from ROADMAP §2/§5).
 *
 * Provider is selected by EMAIL_PROVIDER:
 *   - "resend" — production, via the Resend HTTP API
 *   - "smtp"   — local dev, delivers to Mailpit (bundled with `supabase start`)
 *   - "none" or unset — log-only no-op; the app works with zero email config
 *
 * The from ADDRESS is platform config (EMAIL_FROM_ADDRESS — the seam where
 * per-tenant custom sending domains plug in later). The from NAME and
 * reply-to are per-teacher: parents see "{Studio Name} (via CogNote)" and
 * replies go to the teacher, never to the platform.
 */

import { Resend } from "resend";
import { sendViaSmtp } from "@/lib/server/smtp";

export interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Per-teacher: the teacher's contact email. Parent replies go here. */
  replyTo?: string;
  /** Per-teacher: display name, e.g. `"Morales Piano Studio (via CogNote)"`. */
  fromName?: string;
}

export interface SendEmailResult {
  sent: boolean;
  error?: string;
}

function fromHeader(fromName?: string): string {
  const address =
    process.env.EMAIL_FROM_ADDRESS ?? "notifications@cognote.studio";
  const name = fromName?.trim() || "CogNote Studio";
  // Quote the display name; strip quotes/newlines it can't contain.
  return `"${name.replace(/["\r\n]/g, "")}" <${address}>`;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER ?? "none";

  switch (provider) {
    case "resend":
      return sendWithResend(args);
    case "smtp":
      return sendWithSmtp(args);
    default:
      console.log(
        `[email no-op — EMAIL_PROVIDER=${provider}] to=${args.to} subject="${args.subject}"`
      );
      return { sent: false, error: "Email is not configured" };
  }
}

async function sendWithResend({
  to,
  subject,
  text,
  html,
  replyTo,
  fromName,
}: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("EMAIL_PROVIDER=resend but RESEND_API_KEY is missing");
    return { sent: false, error: "Email is not configured (RESEND_API_KEY missing)" };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromHeader(fromName),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    console.error(`Resend send failed: ${error.name}: ${error.message}`);
    return { sent: false, error: `Email provider error (${error.name})` };
  }
  return { sent: true };
}

async function sendWithSmtp({
  to,
  subject,
  text,
  html,
  replyTo,
  fromName,
}: SendEmailArgs): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST ?? "127.0.0.1";
  const port = Number(process.env.SMTP_PORT ?? 54325);
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ?? "notifications@cognote.studio";

  try {
    await sendViaSmtp({
      host,
      port,
      from: fromAddress,
      fromHeader: fromHeader(fromName),
      to,
      subject,
      text,
      html,
      replyTo,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`SMTP send failed (${host}:${port}): ${message}`);
    return { sent: false, error: `Email provider error (SMTP: ${message})` };
  }
}
