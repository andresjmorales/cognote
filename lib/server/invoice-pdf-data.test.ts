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

interface QueryLog {
  table: string;
  eq: [string, unknown][];
}

/**
 * Fluent stub that records the table and `.eq` predicates per query, so tests
 * can assert tenant scoping. Only `invoices` resolves the fixture; every other
 * table (e.g. `studio_policies`) resolves null.
 */
function stubSupabase(
  invoice: unknown,
  opts: { error?: { message: string } | null } = {}
): { client: SupabaseClient; queries: QueryLog[] } {
  const queries: QueryLog[] = [];
  const client = {
    from(table: string) {
      const log: QueryLog = { table, eq: [] };
      queries.push(log);
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          log.eq.push([column, value]);
          return builder;
        },
        maybeSingle: () =>
          Promise.resolve(
            table === "invoices"
              ? { data: opts.error ? null : invoice, error: opts.error ?? null }
              : { data: null, error: null }
          ),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, queries };
}

describe("loadInvoicePdf", () => {
  it("builds a downloadable PDF for a sent invoice", async () => {
    const { client } = stubSupabase(baseInvoice());
    const result = await loadInvoicePdf(client, {
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

  it("scopes the invoice query to the signed-in teacher", async () => {
    const { client, queries } = stubSupabase(baseInvoice());
    await loadInvoicePdf(client, {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
    });

    expect(queries[0].table).toBe("invoices");
    expect(queries[0].eq).toEqual([
      ["id", "invoice-1"],
      ["teacher_id", TEACHER_ID],
    ]);
  });

  it("rejects an invoice with no line items", async () => {
    const { client } = stubSupabase(baseInvoice({ invoice_items: [] }));
    const result = await loadInvoicePdf(client, {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
    });
    expect(result).toEqual({ ok: false, code: "no_items" });
  });

  it("rejects non-draft invoices when requireDraft is set", async () => {
    const { client } = stubSupabase(baseInvoice());
    const result = await loadInvoicePdf(client, {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
      requireDraft: true,
    });
    expect(result).toEqual({ ok: false, code: "not_draft" });
  });

  it("reports a missing invoice", async () => {
    const { client } = stubSupabase(null);
    const result = await loadInvoicePdf(client, {
      invoiceId: "nope",
      teacherId: TEACHER_ID,
    });
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("reports a missing family", async () => {
    const { client } = stubSupabase(baseInvoice({ guardians: null }));
    const result = await loadInvoicePdf(client, {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
    });
    expect(result).toEqual({ ok: false, code: "no_family" });
  });

  it("reports a database error distinctly from not found", async () => {
    const { client } = stubSupabase(baseInvoice(), {
      error: { message: "boom" },
    });
    const result = await loadInvoicePdf(client, {
      invoiceId: "invoice-1",
      teacherId: TEACHER_ID,
    });
    expect(result).toEqual({ ok: false, code: "db_error" });
  });
});
