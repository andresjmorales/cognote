import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/server/http";
import { sendInvoice } from "@/lib/server/invoice-send";

/**
 * Freeze a draft invoice and email the PDF to the family.
 * Explicit send only — no surprise emails.
 */
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

  const result = await sendInvoice(supabase, {
    invoiceId: id,
    teacherId: user.id,
    teacherEmail: user.email,
    origin: requestOrigin(req),
  });

  if (!result.ok) {
    const status = result.error === "Not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
