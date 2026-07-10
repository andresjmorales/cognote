import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, subtotal_cents")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }
  if (invoice.status === "void") {
    return NextResponse.json(
      { error: "Cannot mark a void invoice as paid" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

  const { error: payError } = await supabase.from("payments").insert({
    invoice_id: id,
    amount_cents: invoice.subtotal_cents,
    method: "manual",
    note,
  });

  if (payError) {
    return NextResponse.json({ error: payError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "manual",
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
