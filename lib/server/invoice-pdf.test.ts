import { describe, it, expect } from "vitest";
import { buildInvoicePdf, toPdfSafeText } from "@/lib/server/invoice-pdf";

describe("toPdfSafeText", () => {
  it("keeps Latin-1 accents used in names", () => {
    expect(toPdfSafeText("Andrés")).toBe("Andrés");
  });

  it("strips emoji that Helvetica cannot encode", () => {
    expect(toPdfSafeText("Andrés❤️")).toBe("Andrés");
    expect(toPdfSafeText("Lesson — Andrés❤️, Aug 10")).toBe(
      "Lesson - Andrés, Aug 10"
    );
  });

  it("maps common punctuation to WinAnsi-safe ASCII", () => {
    expect(toPdfSafeText("“Hi” – there…")).toBe('"Hi" - there...');
  });
});

describe("buildInvoicePdf", () => {
  it("builds a PDF when a line item includes emoji in the student name", async () => {
    const bytes = await buildInvoicePdf({
      studioName: "Morales Piano Studio",
      familyName: "Morales family",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-10",
      currency: "USD",
      items: [
        {
          description: "Lesson — Andrés❤️, Aug 10, 2026 (5 min @ $60.00/hr)",
          quantity: 1,
          unitCents: 500,
          amountCents: 500,
        },
      ],
      subtotalCents: 500,
      paymentInstructions: "",
      notes: "",
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    // PDF magic
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});
