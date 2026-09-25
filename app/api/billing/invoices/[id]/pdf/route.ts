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
    const status = loaded.code === "not_found" || loaded.code === "no_family"
      ? 404
      : 400;
    return NextResponse.json(
      { error: ERROR_MESSAGES[loaded.code] },
      { status }
    );
  }

  const { pdfBytes, filename } = loaded.data;
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
