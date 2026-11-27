import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { buildInvoiceReminderEmail } from "@/lib/invoice-reminder";
import { daysOverdue, summarizePayments } from "@/lib/billing";
import { createCheckoutSession } from "@/lib/payments";
import { expireStaleCheckoutLink, CLEARED_CHECKOUT_LINK } from "@/lib/server/checkout-link";
import {
  familyDisplayName,
  familyEmailBcc,
  familyEmailRecipients,
  familyGreetingNames,
  type FamilyContact,
} from "@/lib/guardians";
import { getPolicy } from "@/lib/server/scheduling";
import { oneToOne } from "@/lib/schedule";

export interface ReminderResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

/** The guardian row the reminder needs: family contact fields plus portal. */
type ReminderFamily = FamilyContact & {
  family_name: string | null;
  portal_token: string | null;
};

/**
 * Undo a claim made at the top of `sendInvoiceReminder`.
 *
 * The claim exists so only ONE run can send; it does not mean the invoice was
 * reminded. Any path that decides not to send has to release it, or an invoice
 * that merely was not due yet — or was paid a minute ago — silently loses its
 * one reminder forever.
 *
 * The release is a compare-and-set on the timestamp WE wrote, not a blind null:
 * without it, a slow run that lost its claim could clear a newer run's stamp and
 * hand the family a second reminder. Returns whether the claim was actually
 * released, so the caller can tell the cron instead of leaving the invoice
 * stamped forever.
 */
async function releaseClaim(
  supabase: SupabaseClient,
  invoiceId: string,
  teacherId: string,
  claimedAt: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("invoices")
    .update({ reminder_sent_at: null })
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .eq("reminder_sent_at", claimedAt)
    .select("id");
  if (error) {
    console.error("reminder release:", invoiceId, error.message ?? error);
    return false;
  }
  if (!data || data.length === 0) {
    // The stamp is no longer the value we wrote: it is not ours to clear.
    console.error("reminder release: claim changed since it was taken", invoiceId);
    return false;
  }
  return true;
}

/**
 * Email the single overdue reminder for one invoice.
 *
 * Stripe studios get a FRESH Checkout session: the one minted at send time has
 * expired by now, so linking it would send the family to a dead button. Manual
 * studios get payment instructions plus the portal link.
 *
 * `reminder_sent_at` is CLAIMED before anything is sent, with a compare-and-set
 * on the null timestamp. One reminder per invoice is the rule, and the cron
 * answers to a bearer token whose deliveries are best-effort (and the bundled
 * compose can hit the same route), so two runs can overlap: only the run that
 * wins the claim emails, and a transient failure still does not start a daily
 * retry loop against a family.
 */
export async function sendInvoiceReminder(
  supabase: SupabaseClient,
  args: { invoiceId: string; teacherId: string; origin: string; now: Date }
): Promise<ReminderResult> {
  const { invoiceId, teacherId, origin, now } = args;
  const claimedAt = now.toISOString();

  // Claim first. Zero rows back means another run already took it (or the row
  // is gone), and the loser of that race must not email anyone.
  const { data: claimed, error: claimError } = await supabase
    .from("invoices")
    .update({ reminder_sent_at: claimedAt })
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .is("reminder_sent_at", null)
    .select("id");

  if (claimError) {
    console.error("reminder claim:", invoiceId, claimError.message ?? claimError);
    return { status: "failed", reason: claimError.message ?? "claim_failed" };
  }
  if (!claimed || claimed.length === 0) {
    return { status: "skipped", reason: "already_reminded" };
  }
  // One line so a claim whose run died mid-way can be spotted in the logs.
  console.log("reminder claimed:", invoiceId, teacherId);

  /** Release the claim; a release that does not land must be reported. */
  const skip = async (reason: string): Promise<ReminderResult> => {
    const released = await releaseClaim(supabase, invoiceId, teacherId, claimedAt);
    return released
      ? { status: "skipped", reason }
      : { status: "failed", reason: "release_failed" };
  };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, status, guardian_id, period_start, period_end, subtotal_cents, currency, sent_at, stripe_checkout_session_id, stripe_checkout_url, payments ( amount_cents ), guardians ( name, family_name, email, secondary_name, secondary_email, email_recipients, portal_token )"
    )
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .single();

  if (error || !invoice) return skip("not_found");
  if (invoice.status !== "sent") return skip("not_sent");
  if (!invoice.sent_at) return skip("no_sent_at");

  const family = oneToOne(
    invoice.guardians as ReminderFamily | ReminderFamily[] | null
  );
  if (!family) return skip("no_family");

  const policy = await getPolicy(supabase, teacherId);
  // Reminders only apply to invoices sent at/after the studio enabled them.
  // null enabled_at means reminders are off entirely — release the claim so
  // another run can retry later if the studio turns reminders on.
  if (
    policy.invoice_reminders_enabled_at &&
    new Date(invoice.sent_at as string) <
      new Date(policy.invoice_reminders_enabled_at)
  ) {
    return skip("not_enabled");
  }

  const summary = summarizePayments(
    invoice.subtotal_cents,
    ((invoice.payments as { amount_cents: number }[] | null) ?? []).map((p) => ({
      amountCents: p.amount_cents,
    }))
  );
  if (summary.balanceCents <= 0) return skip("settled");

  const late = daysOverdue(invoice.sent_at, policy.payment_terms_days, now);
  if (late <= 0) return skip("not_due");

  const portalUrl = family.portal_token ? `${origin}/portal/${family.portal_token}` : origin;
  const stripeKey =
    policy.payment_provider === "stripe" ? policy.stripe_secret_key : null;

  let payUrl: string | null = null;
  // The session this run minted, if any: it is live and charges `summary`'s
  // balance until we expire it.
  let minted: { sessionId: string; url: string } | null = null;

  const clearStoredLink = async () => {
    const { error: clearError } = await supabase
      .from("invoices")
      .update(CLEARED_CHECKOUT_LINK)
      .eq("id", invoice.id)
      .eq("teacher_id", teacherId);
    if (clearError) {
      console.error("reminder clear link:", invoice.id, clearError.message);
    }
  };

  /** Mint a session for `amountCents` and record it on the invoice. */
  const mint = async (
    amountCents: number
  ): Promise<{ sessionId: string; url: string } | null> => {
    if (!stripeKey) return null;
    try {
      const session = await createCheckoutSession({
        secretKey: stripeKey,
        invoiceId: invoice.id,
        teacherId,
        amountCents,
        currency: invoice.currency,
        familyName: familyDisplayName(family),
        studioName: policy.studio_name || "Studio",
        periodLabel: `${invoice.period_start} to ${invoice.period_end}`,
        successUrl: portalUrl,
        cancelUrl: portalUrl,
        customerEmail: family.email,
      });
      const { error: linkError } = await supabase
        .from("invoices")
        .update({
          stripe_checkout_session_id: session.sessionId,
          stripe_checkout_url: session.url,
        })
        .eq("id", invoice.id)
        .eq("teacher_id", teacherId);
      if (linkError) {
        // The session exists but could not be recorded. Clear the link rather
        // than leaving the row claiming a session (the send-time one, say) for
        // a URL nobody will ever be able to expire correctly.
        console.error("reminder checkout link:", invoice.id, linkError.message);
        await clearStoredLink();
      }
      return { sessionId: session.sessionId, url: session.url };
    } catch (err) {
      // Fall back to instructions rather than failing the reminder.
      console.error(
        "reminder checkout:",
        err instanceof Error ? err.message : String(err)
      );
      await clearStoredLink();
      return null;
    }
  };

  if (stripeKey) {
    if (invoice.stripe_checkout_session_id) {
      await expireStaleCheckoutLink(
        supabase,
        teacherId,
        invoice.stripe_checkout_session_id,
        "reminder",
        policy
      );
    }
    minted = await mint(summary.balanceCents);
    payUrl = minted?.url ?? null;
  } else if (invoice.stripe_checkout_session_id || invoice.stripe_checkout_url) {
    // The studio is not on Stripe any more (or dropped its key), but this
    // invoice still carries a session from when it was. The portal renders a
    // "Pay now" button for any sent invoice with a stored URL, so clear it
    // before emailing or the family is handed a dead button.
    await clearStoredLink();
  }

  // A payment can land while the reminder is being built. Re-read the status
  // and the payments right before sending: a live Checkout session minted for
  // an invoice the family has now paid is a double-charge path, and a settled
  // invoice must never be chased at all.
  const { data: fresh } = await supabase
    .from("invoices")
    .select("status, subtotal_cents, payments ( amount_cents )")
    .eq("id", invoice.id)
    .eq("teacher_id", teacherId)
    .single();

  const freshSummary = fresh
    ? summarizePayments(
        fresh.subtotal_cents,
        ((fresh.payments as { amount_cents: number }[] | null) ?? []).map((p) => ({
          amountCents: p.amount_cents,
        }))
      )
    : null;

  if (!fresh || fresh.status !== "sent" || !freshSummary || freshSummary.balanceCents <= 0) {
    // The session just minted is live and there is nothing left to collect:
    // expire it and drop the stored link before releasing the claim, or the
    // portal keeps showing a Pay now button for a zero-balance invoice.
    if (minted) {
      await expireStaleCheckoutLink(
        supabase,
        teacherId,
        minted.sessionId,
        "reminder settled",
        policy
      );
      await clearStoredLink();
    }
    return skip(
      !fresh || fresh.status !== "sent" ? "not_sent" : "settled"
    );
  }

  if (freshSummary.balanceCents !== summary.balanceCents) {
    // A partial payment landed between the balance read and the re-read. The
    // session minted above charges the OLD amount, so the email would quote one
    // balance and the link charge another. Retire that session and mint once
    // for the fresh balance; if that is not possible, clear the link so the
    // email falls back to instructions plus the portal instead of a mismatch.
    if (minted) {
      await expireStaleCheckoutLink(
        supabase,
        teacherId,
        minted.sessionId,
        "balance drift",
        policy
      );
    }
    payUrl = null;
    await clearStoredLink();
    minted = await mint(freshSummary.balanceCents);
    payUrl = minted?.url ?? null;
  }

  const email = buildInvoiceReminderEmail({
    familyGreeting: familyGreetingNames(family),
    studioName: policy.studio_name,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
    balanceCents: freshSummary.balanceCents,
    currency: invoice.currency,
    daysLate: late,
    payUrl,
    paymentInstructions: policy.payment_instructions,
    portalUrl,
  });

  const result = await sendEmail({
    to: familyEmailRecipients(family),
    bcc: familyEmailBcc(policy),
    subject: email.subject,
    text: email.text,
    html: email.html,
    fromName: policy.studio_name ? `${policy.studio_name} (via CogNote)` : undefined,
    portalUrl: family.portal_token ? portalUrl : undefined,
  });

  // No stamp here: the claim made at the top IS the stamp, and it stays even
  // when the send fails — one bad send must not become a daily one.
  return result.sent
    ? { status: "sent" }
    : { status: "failed", reason: result.error ?? "email_failed" };
}
