import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/server/http";
import { sendInvoice } from "@/lib/server/invoice-send";

const ACTIONS = ["send", "delete", "void"] as const;
type BulkAction = (typeof ACTIONS)[number];

/**
 * Bulk actions for the billing list.
 * - send: drafts only (email PDF + freeze)
 * - delete: drafts and void only (never sent/paid history)
 * - void: draft or sent (not paid)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as BulkAction;
  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "action must be send, delete, or void" },
      { status: 400 }
    );
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "No invoices selected" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Select at most 50 invoices at a time" },
      { status: 400 }
    );
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  const origin = requestOrigin(req);

  for (const id of ids) {
    if (action === "send") {
      const result = await sendInvoice(supabase, {
        invoiceId: id,
        teacherId: user.id,
        teacherEmail: user.email,
        origin,
      });
      results.push({
        id,
        ok: result.ok,
        error:
          result.error ??
          result.emailError ??
          result.checkoutError,
      });
      continue;
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("id", id)
      .eq("teacher_id", user.id)
      .single();

    if (!invoice) {
      results.push({ id, ok: false, error: "Not found" });
      continue;
    }

    if (action === "delete") {
      if (invoice.status !== "draft" && invoice.status !== "void") {
        results.push({
          id,
          ok: false,
          error: "Only draft or void invoices can be deleted",
        });
        continue;
      }
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id)
        .eq("teacher_id", user.id);
      results.push({
        id,
        ok: !error,
        error: error?.message,
      });
      continue;
    }

    // void
    if (invoice.status === "paid") {
      results.push({ id, ok: false, error: "Paid invoices cannot be voided" });
      continue;
    }
    if (invoice.status === "void") {
      results.push({ id, ok: true });
      continue;
    }
    const { error } = await supabase
      .from("invoices")
      .update({ status: "void" })
      .eq("id", id)
      .eq("teacher_id", user.id);
    results.push({ id, ok: !error, error: error?.message });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: failed.length === 0,
    succeeded,
    failed,
    results,
  });
}
