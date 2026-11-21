import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY, type StudioPolicy } from "@/lib/schedule";
import { sendInvoiceReminder } from "@/lib/server/invoice-reminder";
import { sendEmail } from "@/lib/email";
import { getPolicy } from "@/lib/server/scheduling";
import { createCheckoutSession, expireCheckoutSession } from "@/lib/payments";
import { CLEARED_CHECKOUT_LINK } from "@/lib/server/checkout-link";

// The sender is mostly I/O: claim, read, maybe mint a session, read again,
// email. Every collaborator that reaches the network is substituted so the
// tests can pin the ORDER of the writes and which paths release the claim.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/server/scheduling", () => ({ getPolicy: vi.fn() }));
vi.mock("@/lib/payments", () => ({
  createCheckoutSession: vi.fn(),
  expireCheckoutSession: vi.fn(),
}));

const INVOICE_ID = "00000000-0000-0000-0000-0000000000aa";
const TEACHER_ID = "00000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-09-01T12:00:00Z");
const ORIGIN = "https://studio.test";

const MANUAL_POLICY: StudioPolicy = {
  ...DEFAULT_POLICY,
  studio_name: "Studio",
  payment_provider: "manual",
  stripe_secret_key: null,
};

const STRIPE_POLICY: StudioPolicy = {
  ...MANUAL_POLICY,
  payment_provider: "stripe",
  stripe_secret_key: "sk_test_123",
};

type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
  eq: [string, unknown][];
  is: [string, unknown][];
}

/**
 * Chainable stub, one queued result per `from("invoices")` call in order.
 * Filters are recorded so a test can assert the claim/release CAS filters.
 */
function stubSupabase(queues: Record<string, QueryResult[]>): {
  client: SupabaseClient;
  calls: Call[];
} {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", eq: [], is: [] };
      calls.push(call);

      const settle = () => {
        const next = queues[table]?.shift() ?? { data: [], error: null };
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
      };

      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (payload: Record<string, unknown>) => {
          call.op = "insert";
          call.payload = payload;
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        delete: () => builder,
        eq: (column: string, value: unknown) => {
          call.eq.push([column, value]);
          return builder;
        },
        is: (column: string, value: unknown) => {
          call.is.push([column, value]);
          return builder;
        },
        in: () => builder,
        not: () => builder,
        gte: () => builder,
        lte: () => builder,
        order: () => builder,
        limit: () => builder,
        single: settle,
        maybeSingle: settle,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          settle().then(resolve, reject),
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    status: "sent",
    guardian_id: "guardian-1",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    subtotal_cents: 10000,
    currency: "USD",
    sent_at: "2026-08-01T00:00:00Z",
    stripe_checkout_session_id: null,
    stripe_checkout_url: null,
    payments: [] as { amount_cents: number }[],
    guardians: {
      name: "Ana",
      family_name: null,
      email: "ana@example.com",
      portal_token: "tok",
    },
    ...overrides,
  };
}

const claimTaken = { data: [{ id: INVOICE_ID }] };

/** Updates that set the stamp back to null, i.e. released a claim. */
function releases(calls: Call[]): Call[] {
  return calls.filter(
    (c) => c.table === "invoices" && c.op === "update" && c.payload?.reminder_sent_at === null
  );
}

/** Updates that leave a claim in place (the claim itself). */
function claims(calls: Call[]): Call[] {
  return calls.filter(
    (c) =>
      c.table === "invoices" &&
      c.op === "update" &&
      typeof c.payload?.reminder_sent_at === "string"
  );
}

async function run(client: SupabaseClient) {
  return sendInvoiceReminder(client, {
    invoiceId: INVOICE_ID,
    teacherId: TEACHER_ID,
    origin: ORIGIN,
    now: NOW,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPolicy).mockResolvedValue(MANUAL_POLICY);
  vi.mocked(sendEmail).mockResolvedValue({ sent: true });
  vi.mocked(createCheckoutSession).mockResolvedValue({
    sessionId: "sess_fresh",
    url: "https://checkout.test/fresh",
  });
  vi.mocked(expireCheckoutSession).mockResolvedValue(undefined);
});

describe("sendInvoiceReminder - paths that do not send", () => {
  const cases: { name: string; rows: QueryResult[]; reason: string }[] = [
    {
      name: "the invoice cannot be read",
      rows: [claimTaken, { data: null, error: { message: "not found" } }],
      reason: "not_found",
    },
    { name: "it is no longer sent", rows: [claimTaken, { data: invoiceRow({ status: "draft" }) }], reason: "not_sent" },
    { name: "it has no sent_at", rows: [claimTaken, { data: invoiceRow({ sent_at: null }) }], reason: "no_sent_at" },
    { name: "it has no family", rows: [claimTaken, { data: invoiceRow({ guardians: null }) }], reason: "no_family" },
    {
      name: "it is already settled",
      rows: [claimTaken, { data: invoiceRow({ payments: [{ amount_cents: 10000 }] }) }],
      reason: "settled",
    },
    {
      name: "its terms have not elapsed",
      rows: [claimTaken, { data: invoiceRow({ sent_at: "2026-08-25T00:00:00Z" }) }],
      reason: "not_due",
    },
  ];

  it.each(cases)("releases the claim when $name", async ({ rows, reason }) => {
    const { client, calls } = stubSupabase({
      invoices: [...rows, { data: [{ id: INVOICE_ID }] }],
    });

    const result = await run(client);

    expect(result).toEqual({ status: "skipped", reason });
    expect(sendEmail).not.toHaveBeenCalled();
    const released = releases(calls);
    expect(released).toHaveLength(1);
    // The release is a compare-and-set on the value this run wrote, not a
    // blind null that could clear a newer run's claim.
    expect(released[0].eq).toEqual([
      ["id", INVOICE_ID],
      ["teacher_id", TEACHER_ID],
      ["reminder_sent_at", NOW.toISOString()],
    ]);
  });

  it("reports a release that did not land instead of pretending it skipped", async () => {
    const { client } = stubSupabase({
      invoices: [
        claimTaken,
        { data: invoiceRow({ sent_at: "2026-08-25T00:00:00Z" }) },
        // Nothing matched the CAS: the stamp is not the value we wrote.
        { data: [] },
      ],
    });

    const result = await run(client);

    expect(result).toEqual({ status: "failed", reason: "release_failed" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when another run holds the claim", async () => {
    const { client, calls } = stubSupabase({ invoices: [{ data: [] }] });

    const result = await run(client);

    expect(result).toEqual({ status: "skipped", reason: "already_reminded" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(releases(calls)).toHaveLength(0);
  });
});

describe("sendInvoiceReminder - the send path", () => {
  it("claims null-timestamped, sends, and leaves the stamp in place", async () => {
    const { client, calls } = stubSupabase({
      invoices: [claimTaken, { data: invoiceRow() }, { data: invoiceRow() }],
    });

    const result = await run(client);

    expect(result).toEqual({ status: "sent" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(claims(calls)[0].payload).toEqual({ reminder_sent_at: NOW.toISOString() });
    expect(claims(calls)[0].is).toEqual([["reminder_sent_at", null]]);
    // The stamp is the claim: nothing releases it after a send.
    expect(releases(calls)).toHaveLength(0);
    // Manual studios get instructions and the portal, never a pay link.
    expect(String(vi.mocked(sendEmail).mock.calls[0][0].text)).toContain(
      `${ORIGIN}/portal/tok`
    );
  });

  it("expires the session it just minted when a payment settles the invoice mid-build", async () => {
    vi.mocked(getPolicy).mockResolvedValue(STRIPE_POLICY);
    const { client, calls } = stubSupabase({
      invoices: [
        claimTaken,
        { data: invoiceRow({ stripe_checkout_session_id: "sess_old" }) },
        { error: null }, // record the freshly minted session
        { data: invoiceRow({ payments: [{ amount_cents: 10000 }] }) },
        { error: null }, // clear the stored link
        { data: [{ id: INVOICE_ID }] }, // release the claim
      ],
    });

    const result = await run(client);

    expect(result).toEqual({ status: "skipped", reason: "settled" });
    expect(sendEmail).not.toHaveBeenCalled();
    // The stale send-time session and the one minted a moment ago are both
    // expired: neither may stay chargeable for a settled invoice.
    expect(vi.mocked(expireCheckoutSession).mock.calls.map((c) => c[1])).toEqual([
      "sess_old",
      "sess_fresh",
    ]);
    const cleared = calls.filter(
      (c) => c.op === "update" && c.payload?.stripe_checkout_session_id === null
    );
    expect(cleared).toHaveLength(1);
    expect(cleared[0].payload).toEqual(CLEARED_CHECKOUT_LINK);
    expect(releases(calls)).toHaveLength(1);
  });

  it("re-mints once for a balance that changed mid-build", async () => {
    vi.mocked(getPolicy).mockResolvedValue(STRIPE_POLICY);
    vi.mocked(createCheckoutSession)
      .mockResolvedValueOnce({ sessionId: "sess_stale", url: "https://checkout.test/stale" })
      .mockResolvedValueOnce({ sessionId: "sess_fresh", url: "https://checkout.test/fresh" });
    const { client, calls } = stubSupabase({
      invoices: [
        claimTaken,
        { data: invoiceRow() },
        { error: null }, // record the stale-amount session
        { data: invoiceRow({ payments: [{ amount_cents: 4000 }] }) },
        { error: null }, // clear the stale link
        { error: null }, // record the re-minted session
      ],
    });

    const result = await run(client);

    expect(result).toEqual({ status: "sent" });
    const amounts = vi.mocked(createCheckoutSession).mock.calls.map(
      (c) => c[0].amountCents
    );
    expect(amounts).toEqual([10000, 6000]);
    // The stale-amount session is retired, not merely forgotten.
    expect(vi.mocked(expireCheckoutSession).mock.calls.map((c) => c[1])).toEqual([
      "sess_stale",
    ]);
    const text = String(vi.mocked(sendEmail).mock.calls[0][0].text);
    expect(text).toContain("https://checkout.test/fresh");
    expect(text).not.toContain("https://checkout.test/stale");
    expect(releases(calls)).toHaveLength(0);
  });
});
