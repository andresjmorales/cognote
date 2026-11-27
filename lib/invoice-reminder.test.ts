import { describe, it, expect } from "vitest";
import { buildInvoiceReminderEmail } from "@/lib/invoice-reminder";

const base = {
  familyGreeting: "Ana & Luis",
  studioName: "Casa Musical",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  balanceCents: 24_000,
  currency: "USD",
  daysLate: 6,
  payUrl: "https://pay.stripe.test/c/pay_123",
  paymentInstructions: "Bank transfer to DBS 123-456",
  portalUrl: "https://cognote.studio/portal/tok_abc",
};

describe("buildInvoiceReminderEmail", () => {
  it("states the balance, the period and the lateness", () => {
    const email = buildInvoiceReminderEmail(base);
    expect(email.subject).toContain("Reminder");
    expect(email.text).toContain("$240.00");
    expect(email.text).toContain("2026-11-01 to 2026-11-30");
    expect(email.text).toContain("6 days");
    expect(email.text).toContain("https://pay.stripe.test/c/pay_123");
  });

  it("carries the billing period in the subject", () => {
    const email = buildInvoiceReminderEmail(base);
    expect(email.subject).toContain("2026-11-01 to 2026-11-30");
  });

  it("says one day, not one days", () => {
    const email = buildInvoiceReminderEmail({ ...base, daysLate: 1 });
    expect(email.text).toContain("1 day past due");
    expect(email.text).not.toContain("1 days");
  });

  it("falls back to instructions and the portal when there is no pay link", () => {
    const email = buildInvoiceReminderEmail({ ...base, payUrl: null });
    expect(email.text).toContain("DBS 123-456");
    expect(email.text).toContain(base.portalUrl);
    expect(email.html).toContain("DBS 123-456");
    expect(email.html).toContain(base.portalUrl);
  });

  it("omits the empty instructions paragraph when there are no instructions", () => {
    const email = buildInvoiceReminderEmail({
      ...base,
      payUrl: null,
      paymentInstructions: "   ",
    });
    expect(email.html).not.toContain('style="white-space:pre-wrap;"');
    expect(email.html).toContain(`<a href="${base.portalUrl}">Open your family portal</a>`);
  });

  it("escapes HTML in family and studio names", () => {
    const email = buildInvoiceReminderEmail({
      ...base,
      familyGreeting: "<script>x</script>",
      studioName: "A & B",
    });
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A &amp; B");
  });

  it("escapes a quote in the pay link so it cannot inject an attribute", () => {
    const email = buildInvoiceReminderEmail({
      ...base,
      payUrl: 'https://x.test/?a="onmouseover=1',
    });
    expect(email.html).toContain("&quot;onmouseover");
    expect(email.html).not.toContain('href="https://x.test/?a="');
  });
});
