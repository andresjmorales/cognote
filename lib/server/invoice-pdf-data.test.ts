import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadInvoicePdf } from "@/lib/server/invoice-pdf-data";

const TEACHER_ID = "00000000-0000-0000-0000-000000000001";

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "invoice-1",
    status: "sent",
    currency: "USD",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    subtotal_cents: 5000,
    notes: "Thanks",
    stripe_checkout_url: null,
    stripe_checkout_session_id: null,
    sent_at: "2026-09-01T00:00:00Z",
    guardians: {
      name: "Jordan Lee",
      family_name: "Lee",
      email: "jordan@example.com",
      secondary_name: null,
      secondary_email: null,
      email_recipients: "primary",
      portal_token: "portal-token",
    },
    invoice_items: [
      {
        description: "Lesson",
        quantity: 1,
        unit_cents: 5000,
        amount_cents: 5000,
        sort_order: 0,
      },
    ],
    ...overrides,
  };
}

/** Minimal fluent stub: invoices resolve `invoice`, everything else is null. */
function stubSupabase(invoice: unknown): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: () => Promise.resolve({ data: invoice, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

describe("loadInvoicePdf", () => {
  it("builds a downloadable PDF for a sent invoice", async () => {
    const result = await loadInvoicePdf(stubSupabase(baseInvoice()), {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.filename).toBe("invoice-2026-08-01.pdf");
    expect(result.data.pdfBytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...result.data.pdfBytes.slice(0, 4))).toBe(
      "%PDF"
    );
  });

  it("rejects an invoice with no line items", async () => {
    const result = await loadInvoicePdf(
      stubSupabase(baseInvoice({ invoice_items: [] })),
      { invoiceId: "invoice-1", teacherId: TEACHER_ID }
    );
    expect(result).toEqual({ ok: false, code: "no_items" });
  });

  it("rejects non-draft invoices when requireDraft is set", async () => {
    const result = await loadInvoicePdf(stubSupabase(baseInvoice()), {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
      requireDraft: true,
    });
    expect(result).toEqual({ ok: false, code: "not_draft" });
  });

  it("reports a missing invoice", async () => {
    const result = await loadInvoicePdf(stubSupabase(null), {
      invoiceId: "nope",
      teacherId: TEACHER_ID,
    });
    expect(result).toEqual({ ok: false, code: "not_found" });
  });
});
