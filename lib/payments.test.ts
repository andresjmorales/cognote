import { describe, it, expect } from "vitest";
import { buildCheckoutSessionParams } from "@/lib/payments";
import { stripeCheckoutPrefillEmail } from "@/lib/guardians";

const baseArgs = {
  invoiceId: "inv-1",
  teacherId: "teacher-1",
  amountCents: 500,
  currency: "USD",
  familyName: "Morales family",
  studioName: "Morales Piano Studio",
  periodLabel: "2026-08-01 – 2026-08-10",
  successUrl: "https://example.com/portal/abc?paid=1",
  cancelUrl: "https://example.com/portal/abc",
};

describe("buildCheckoutSessionParams", () => {
  it("omits customer_email when prefill is null (both guardians)", () => {
    const family = {
      name: "Andres",
      email: "primary@example.com",
      secondary_name: "Gloria",
      secondary_email: "secondary@example.com",
      email_recipients: "both" as const,
    };
    const params = buildCheckoutSessionParams({
      ...baseArgs,
      customerEmail: stripeCheckoutPrefillEmail(family),
    });
    expect(params.customer_email).toBeUndefined();
    expect("customer_email" in params).toBe(false);
  });

  it("sets customer_email for a single recipient", () => {
    const family = {
      name: "Andres",
      email: "primary@example.com",
      secondary_name: "Gloria",
      secondary_email: "secondary@example.com",
      email_recipients: "secondary" as const,
    };
    const params = buildCheckoutSessionParams({
      ...baseArgs,
      customerEmail: stripeCheckoutPrefillEmail(family),
    });
    expect(params.customer_email).toBe("secondary@example.com");
  });
});
