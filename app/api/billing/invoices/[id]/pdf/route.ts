import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadInvoicePdf,
  type DownloadableInvoicePdfErrorCode,
} from "@/lib/server/invoice-pdf-data";

const ERROR_MESSAGES: Record<DownloadableInvoicePdfErrorCode, string> = {
  not_found: "Not found",
  no_items: "Add at least one line item before downloading",
  no_family: "Family not found",
  pdf_failed:
    "Could not build the invoice PDF. Try removing emoji from names or notes.",
  db_error: "Could not load the invoice. Try again.",
};

const ERROR_STATUS: Record<DownloadableInvoicePdfErrorCode, number> = {
  not_found: 404,
  no_family: 404,
  no_items: 400,
  pdf_failed: 500,
  db_error: 500,
};

/**
 * Download an invoice PDF without sending it. Works for any invoice with line
 * items (draft, sent, or paid) so a sent invoice stays retrievable.
 */
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

  const loaded = await loadInvoicePdf(supabase, {
    invoiceId: id,
    teacherId: user.id,
  });

  if (!loaded.ok) {
    return NextResponse.json(
      { error: ERROR_MESSAGES[loaded.code] },
      { status: ERROR_STATUS[loaded.code] }
    );
  }

  const { pdfBytes, filename } = loaded.data;
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
