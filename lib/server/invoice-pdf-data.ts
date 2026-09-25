import type { SupabaseClient } from "@supabase/supabase-js";
import { getPolicy } from "@/lib/server/scheduling";
import { buildInvoicePdf } from "@/lib/server/invoice-pdf";
import { familyDisplayName, type FamilyContact } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";

/**
 * Shared invoice -> PDF assembly. The send path (email attachment) and the
 * download route both need the same invoice/guardian/line-item/policy query,
 * so they live here to keep a sent invoice retrievable and the two PDFs
 * identical.
 */

type StudioPolicy = Awaited<ReturnType<typeof getPolicy>>;

export interface InvoicePdfItemRow {
  description: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number;
  sort_order: number;
}

export interface InvoicePdfFamilyRow extends FamilyContact {
  family_name: string | null;
  portal_token: string | null;
}

export interface InvoicePdfInvoiceRow {
  id: string;
  status: string;
  currency: string;
  period_start: string;
  period_end: string;
  subtotal_cents: number;
  notes: string | null;
  stripe_checkout_url: string | null;
  stripe_checkout_session_id: string | null;
  sent_at: string | null;
  guardians: InvoicePdfFamilyRow | InvoicePdfFamilyRow[] | null;
  invoice_items: InvoicePdfItemRow[] | null;
}

export interface InvoicePdfBundle {
  invoice: InvoicePdfInvoiceRow;
  family: InvoicePdfFamilyRow;
  policy: StudioPolicy;
  items: InvoicePdfItemRow[];
  pdfBytes: Uint8Array;
  filename: string;
}

export type LoadInvoicePdfErrorCode =
  | "not_found"
  | "not_draft"
  | "no_items"
  | "no_family"
  | "pdf_failed"
  | "db_error";

/** Codes a non-draft-gated caller (e.g. the download route) can receive. */
export type DownloadableInvoicePdfErrorCode = Exclude<
  LoadInvoicePdfErrorCode,
  "not_draft"
>;

export interface LoadInvoicePdfOk {
  ok: true;
  data: InvoicePdfBundle;
}

export type LoadInvoicePdfFailure<
  C extends LoadInvoicePdfErrorCode = LoadInvoicePdfErrorCode,
> = { ok: false; code: C };

export type LoadInvoicePdfResult = LoadInvoicePdfOk | LoadInvoicePdfFailure;

export interface LoadInvoicePdfOptions {
  invoiceId: string;
  teacherId: string;
  requireDraft?: boolean;
}

/**
 * Load an invoice (scoped to its teacher) and build its PDF in memory. Not
 * status-gated by default, so sent/paid invoices stay downloadable; pass
 * `requireDraft` for the send path.
 */
export function loadInvoicePdf(
  supabase: SupabaseClient,
  opts: LoadInvoicePdfOptions & { requireDraft: true }
): Promise<LoadInvoicePdfOk | LoadInvoicePdfFailure>;
export function loadInvoicePdf(
  supabase: SupabaseClient,
  opts: LoadInvoicePdfOptions & { requireDraft?: false }
): Promise<LoadInvoicePdfOk | LoadInvoicePdfFailure<DownloadableInvoicePdfErrorCode>>;
export async function loadInvoicePdf(
  supabase: SupabaseClient,
  opts: LoadInvoicePdfOptions
): Promise<LoadInvoicePdfResult> {
  const { invoiceId, teacherId, requireDraft = false } = opts;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      guardians (
        id, name, family_name, email, secondary_name, secondary_email,
        email_recipients, portal_token
      ),
      invoice_items ( * )
    `
    )
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error) {
    console.error("loadInvoicePdf query failed:", error.message);
    return { ok: false, code: "db_error" };
  }

  const invoice = data as unknown as InvoicePdfInvoiceRow | null;
  if (!invoice) return { ok: false, code: "not_found" };
  if (requireDraft && invoice.status !== "draft") {
    return { ok: false, code: "not_draft" };
  }

  const items = (invoice.invoice_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  if (items.length === 0) return { ok: false, code: "no_items" };

  const policy = await getPolicy(supabase, teacherId);
  const family = oneToOne(invoice.guardians);
  if (!family) return { ok: false, code: "no_family" };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf({
      studioName: policy.studio_name,
      familyName: familyDisplayName(family),
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      currency: invoice.currency,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitCents: i.unit_cents,
        amountCents: i.amount_cents,
      })),
      subtotalCents: invoice.subtotal_cents,
      paymentInstructions: policy.payment_instructions,
      paymentQrCode:
        policy.payment_provider === "manual" ? policy.payment_qr_code : null,
      notes: invoice.notes ?? undefined,
    });
  } catch (err) {
    console.error(
      "Invoice PDF build failed:",
      err instanceof Error ? err.message : err
    );
    return { ok: false, code: "pdf_failed" };
  }

  return {
    ok: true,
    data: {
      invoice,
      family,
      policy,
      items,
      pdfBytes,
      filename: `invoice-${invoice.period_start}.pdf`,
    },
  };
}
