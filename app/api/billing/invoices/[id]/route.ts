import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sumAmountCents } from "@/lib/billing";

export async function GET(
  _req: NextRequest,
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

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      guardians ( id, name, family_name, email, secondary_email, email_recipients, portal_token ),
      invoice_items ( * ),
      payments ( * )
    `
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function PUT(
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

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited" },
      { status: 400 }
    );
  }

  const body = await req.json();

  // A prepaid-credits invoice's single line is set by the package; only its
  // notes are editable.
  const { data: creditPackage } = await supabase
    .from("credit_packages")
    .select("id")
    .eq("invoice_id", id)
    .maybeSingle();

  if (Array.isArray(body.items) && !creditPackage) {
    const items = body.items as {
      id?: string;
      lessonId?: string | null;
      description: string;
      quantity: number;
      unitCents: number;
      amountCents: number;
    }[];

    // Items are replaced wholesale; keep each existing line's kind so travel
    // fees stay travel fees (a redeemed lesson may still owe one).
    const { data: existingItems } = await supabase
      .from("invoice_items")
      .select("id, kind")
      .eq("invoice_id", id);
    const kindById = new Map(
      (existingItems ?? []).map((i) => [i.id as string, i.kind as string])
    );

    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("invoice_items").insert(
        items.map((item, idx) => ({
          invoice_id: id,
          lesson_id: item.lessonId ?? null,
          kind:
            item.id && kindById.get(item.id) === "travel" ? "travel" : "lesson",
          description: String(item.description).slice(0, 500),
          quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
          unit_cents: Math.max(0, Math.round(Number(item.unitCents) || 0)),
          amount_cents: Math.max(0, Math.round(Number(item.amountCents) || 0)),
          sort_order: idx,
        }))
      );
      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }

    const subtotal = sumAmountCents(
      items.map((i) => ({
        amountCents: Math.max(0, Math.round(Number(i.amountCents) || 0)),
      }))
    );

    const { error } = await supabase
      .from("invoices")
      .update({
        subtotal_cents: subtotal,
        ...(body.notes !== undefined && {
          notes: String(body.notes).slice(0, 2000),
        }),
      })
      .eq("id", id)
      .eq("teacher_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (body.notes !== undefined) {
    const { error } = await supabase
      .from("invoices")
      .update({ notes: String(body.notes).slice(0, 2000) })
      .eq("id", id)
      .eq("teacher_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
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

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "draft" && existing.status !== "void") {
    return NextResponse.json(
      { error: "Only draft or void invoices can be deleted" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
