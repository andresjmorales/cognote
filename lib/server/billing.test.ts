import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY, type StudioPolicy } from "@/lib/schedule";
import { createDraftInvoices } from "@/lib/server/billing";
import { recordRedemptions } from "@/lib/server/credits";

// The redemption write is the one step that needs a real credit balance to
// reach, so its failure branch is pinned by substituting just that function
// and keeping the rest of the credits module real.
vi.mock("@/lib/server/credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/credits")>();
  return { ...actual, recordRedemptions: vi.fn() };
});

const TEACHER_ID = "00000000-0000-0000-0000-000000000001";
const PERIOD_START = "2026-08-01";
const PERIOD_END = "2026-08-31";
const POLICY: StudioPolicy = { ...DEFAULT_POLICY };

type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  select?: string;
  eq: [string, unknown][];
  in: [string, unknown[]][];
  is: [string, unknown][];
  neq: [string, unknown][];
}

/**
 * Chainable stub: every `from(table)` starts a call whose awaited result is the
 * next queued entry for that table (or `{ data: [], error: null }`). Only the
 * handful of builder methods the billing module uses are implemented; anything
 * else returns the builder so `.order().limit()` style chains keep working.
 *
 * Filters are recorded, not applied: the tests assert what the query ASKS for
 * (which columns, which bounds, which status filter), because that is the part
 * a regression changes.
 */
function stubSupabase(queues: Record<string, QueryResult[]>): {
  client: SupabaseClient;
  calls: Call[];
} {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", eq: [], in: [], is: [], neq: [] };
      calls.push(call);

      const settle = () => {
        const next = queues[table]?.shift() ?? { data: [], error: null };
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
      };

      const builder: Record<string, unknown> = {
        select: (columns?: string) => {
          call.select = columns;
          return builder;
        },
        insert: (payload: unknown) => {
          call.op = "insert";
          call.payload = payload;
          return builder;
        },
        update: (payload: unknown) => {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        delete: () => {
          call.op = "delete";
          return builder;
        },
        eq: (column: string, value: unknown) => {
          call.eq.push([column, value]);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          call.in.push([column, values]);
          return builder;
        },
        is: (column: string, value: unknown) => {
          call.is.push([column, value]);
          return builder;
        },
        neq: (column: string, value: unknown) => {
          call.neq.push([column, value]);
          return builder;
        },
        not: () => builder,
        gte: () => builder,
        lte: () => builder,
        order: () => builder,
        limit: () => builder,
        single: settle,
        maybeSingle: settle,
        // `await builder` goes through then, which is how every read settles.
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          settle().then(resolve, reject),
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

function lessonRow(
  id: string,
  opts: { guardianId?: string; studentId?: string; rateCents?: number } = {}
) {
  const studentId = opts.studentId ?? "student-1";
  return {
    id,
    student_id: studentId,
    lesson_date: "2026-08-05",
    starts_at: "2026-08-05T16:00:00Z",
    duration_minutes: 60,
    makeup_for: null,
    slot_id: "slot-1",
    is_home_visit: false,
    students: {
      id: studentId,
      name: "Ada",
      guardian_id: opts.guardianId ?? "guardian-1",
      default_rate_cents: null,
      travel_fee_cents: null,
    },
    lesson_slots: { rate_cents: opts.rateCents ?? 6000 },
    attendance: [{ status: "attended", notice_at: null }],
  };
}

function writes(calls: Call[], table: string, op: Call["op"]): Call[] {
  return calls.filter((c) => c.table === table && c.op === op);
}

describe("createDraftInvoices", () => {
  it("creates one invoice per family with its line items", async () => {
    const { client, calls } = stubSupabase({
      // Two invoice_items reads: lesson lines, then travel lines.
      invoice_items: [{ data: [] }, { data: [] }],
      lessons: [
        {
          data: [
            lessonRow("lesson-1"),
            lessonRow("lesson-2", { studentId: "student-2" }),
          ],
        },
      ],
      invoices: [{ data: { id: "invoice-1" } }],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBeUndefined();
    expect(result.created).toEqual(["invoice-1"]);
    expect(result.skippedAlreadyInvoiced).toBe(0);

    const invoiceInserts = writes(calls, "invoices", "insert");
    expect(invoiceInserts).toHaveLength(1);
    expect(invoiceInserts[0].payload).toMatchObject({
      teacher_id: TEACHER_ID,
      guardian_id: "guardian-1",
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      status: "draft",
      // A lesson draft says so explicitly: the column default would hide the
      // fact that purchase invoices share this table.
      source: "lessons",
      subtotal_cents: 12000,
    });

    const itemInserts = writes(calls, "invoice_items", "insert");
    expect(itemInserts).toHaveLength(1);
    const rows = itemInserts[0].payload as { invoice_id: string; sort_order: number }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.invoice_id === "invoice-1")).toBe(true);
    expect(rows.map((row) => row.sort_order)).toEqual([0, 1]);
  });

  it("skips a lesson already on a non-void invoice and counts it", async () => {
    const { client } = stubSupabase({
      invoice_items: [
        {
          data: [
            {
              lesson_id: "lesson-1",
              invoices: { id: "invoice-old", status: "sent" },
            },
          ],
        },
        { data: [] },
      ],
      lessons: [{ data: [lessonRow("lesson-1"), lessonRow("lesson-2")] }],
      invoices: [{ data: { id: "invoice-1" } }],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBeUndefined();
    expect(result.skippedAlreadyInvoiced).toBe(1);
    expect(result.created).toEqual(["invoice-1"]);
  });

  it("deletes the invoice it just made when the line items fail", async () => {
    const { client, calls } = stubSupabase({
      invoice_items: [
        { data: [] },
        { data: [] },
        { error: { message: "items boom" } },
      ],
      lessons: [{ data: [lessonRow("lesson-1")] }],
      invoices: [{ data: { id: "invoice-1" } }, { error: null }],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBe("items boom");
    expect(result.created).toEqual([]);

    const deletes = writes(calls, "invoices", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].eq).toEqual([["id", "invoice-1"]]);
  });

  it("treats a 23505 on the invoice insert as already drafted", async () => {
    const { client } = stubSupabase({
      invoice_items: [{ data: [] }, { data: [] }],
      lessons: [{ data: [lessonRow("lesson-1")] }],
      invoices: [
        {
          data: null,
          error: {
            message: "duplicate key value violates unique constraint",
            code: "23505",
          },
        },
      ],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBeUndefined();
    expect(result.created).toEqual([]);
  });

  it("aborts on an invoice-insert error that is not a duplicate", async () => {
    const { client, calls } = stubSupabase({
      invoice_items: [{ data: [] }, { data: [] }],
      lessons: [{ data: [lessonRow("lesson-1")] }],
      invoices: [
        { data: null, error: { message: "boom", code: "42501" } },
      ],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBe("boom");
    expect(result.created).toEqual([]);
    expect(writes(calls, "invoice_items", "insert")).toHaveLength(0);
  });

  it("carries on to the next family after a 23505", async () => {
    const { client, calls } = stubSupabase({
      invoice_items: [{ data: [] }, { data: [] }, { error: null }],
      lessons: [
        {
          data: [
            lessonRow("lesson-1", { guardianId: "guardian-1" }),
            lessonRow("lesson-2", { guardianId: "guardian-2" }),
          ],
        },
      ],
      invoices: [
        {
          data: null,
          error: {
            message: "duplicate key value violates unique constraint",
            code: "23505",
          },
        },
        { data: { id: "invoice-2" } },
      ],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBeUndefined();
    expect(result.created).toEqual(["invoice-2"]);
    const invoiceInserts = writes(calls, "invoices", "insert");
    expect(invoiceInserts).toHaveLength(2);
    expect(invoiceInserts[1].payload).toMatchObject({
      guardian_id: "guardian-2",
      source: "lessons",
    });
  });

  it("aborts without invoicing when recording redemptions fails", async () => {
    vi.mocked(recordRedemptions).mockResolvedValueOnce("redemption boom");
    const { client, calls } = stubSupabase({
      invoice_items: [{ data: [] }, { data: [] }],
      lessons: [{ data: [lessonRow("lesson-1")] }],
    });

    const result = await createDraftInvoices(
      client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(result.error).toBe("redemption boom");
    expect(result.created).toEqual([]);
    expect(result.creditsUsed).toBe(0);
    expect(writes(calls, "invoices", "insert")).toHaveLength(0);
  });

  it("applies the period skip only when skipAlreadyDrafted is set", async () => {
    const queues = (preCheckResult: boolean) => ({
      invoice_items: [{ data: [] }, { data: [] }],
      lessons: [{ data: [lessonRow("lesson-1")] }],
      // The pre-check sees a voided invoice for this family and period. The
      // manual run never queries, so it goes straight to the insert.
      invoices: preCheckResult
        ? [
            { data: [{ guardian_id: "guardian-1", status: "void" }] },
            { data: { id: "invoice-1" } },
          ]
        : [{ data: { id: "invoice-1" } }],
    });

    const cron = stubSupabase(queues(true));
    const cronResult = await createDraftInvoices(
      cron.client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY,
      { skipAlreadyDrafted: true }
    );

    const preCheck = cron.calls.find(
      (c) => c.table === "invoices" && c.op === "select"
    );
    expect(preCheck?.select).toBe("guardian_id");
    expect(preCheck?.eq).toEqual([
      ["teacher_id", TEACHER_ID],
      ["period_start", PERIOD_START],
      ["period_end", PERIOD_END],
    ]);
    // ANY status counts, a void invoice included: this gate asks whether the
    // family+period was already attempted, so a status filter here is a bug.
    expect(preCheck?.neq).toEqual([]);
    expect(preCheck?.is).toEqual([]);
    expect(preCheck?.in).toEqual([["guardian_id", ["guardian-1"]]]);
    expect(cronResult.error).toBeUndefined();
    expect(cronResult.created).toEqual([]);
    expect(writes(cron.calls, "invoices", "insert")).toHaveLength(0);

    // The teacher's manual route passes nothing: void + regenerate still works.
    const manual = stubSupabase(queues(false));
    const manualResult = await createDraftInvoices(
      manual.client,
      TEACHER_ID,
      PERIOD_START,
      PERIOD_END,
      POLICY
    );

    expect(
      manual.calls.some((c) => c.table === "invoices" && c.op === "select")
    ).toBe(false);
    expect(manualResult.error).toBeUndefined();
    expect(manualResult.created).toEqual(["invoice-1"]);
  });
});
