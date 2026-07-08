/**
 * Transactional email via Resend (ROADMAP §6).
 *
 * Degrades gracefully: without RESEND_API_KEY the send is skipped and logged,
 * so local/self-hosted setups work with zero cloud accounts. Sends from the
 * cognote.studio domain (never .fun — deliverability + professionalism).
 */

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailArgs): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "CogNote Studio <notifications@cognote.studio>";

  if (!apiKey) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return { sent: false, error: "Email is not configured (RESEND_API_KEY missing)" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend send failed (${res.status}): ${body}`);
    return { sent: false, error: `Email provider error (${res.status})` };
  }
  return { sent: true };
}
