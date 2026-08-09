import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familyDisplayName } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";

/** CSV export of payments for accounting. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("payments")
    .select(
      `
      id, amount_cents, method, external_id, recorded_at, note,
      invoices!inner (
        id, period_start, period_end, currency, teacher_id,
        guardians ( name, family_name )
      )
    `
    )
    .eq("invoices.teacher_id", user.id)
    .order("recorded_at", { ascending: false });

  if (from) query = query.gte("recorded_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("recorded_at", `${to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = [
    [
      "recorded_at",
      "family",
      "period_start",
      "period_end",
      "amount",
      "currency",
      "method",
      "external_id",
      "note",
      "invoice_id",
    ].join(","),
  ];

  for (const payment of data ?? []) {
    const invoice = oneToOne(
      payment.invoices as
        | {
            id: string;
            period_start: string;
            period_end: string;
            currency: string;
            guardians:
              | { name: string; family_name: string | null }
              | { name: string; family_name: string | null }[]
              | null;
          }
        | {
            id: string;
            period_start: string;
            period_end: string;
            currency: string;
            guardians:
              | { name: string; family_name: string | null }
              | { name: string; family_name: string | null }[]
              | null;
          }[]
        | null
    );
    if (!invoice) continue;
    const family = oneToOne(invoice.guardians);
    const familyName = family ? familyDisplayName(family) : "";
    rows.push(
      [
        csv(payment.recorded_at),
        csv(familyName),
        csv(invoice.period_start),
        csv(invoice.period_end),
        csv((payment.amount_cents / 100).toFixed(2)),
        csv(invoice.currency),
        csv(payment.method),
        csv(payment.external_id ?? ""),
        csv(payment.note ?? ""),
        csv(invoice.id),
      ].join(",")
    );
  }

  const csvBody = rows.join("\n") + "\n";
  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-export.csv"`,
    },
  });
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
