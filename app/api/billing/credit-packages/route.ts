import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import {
  creditPackageCreateSchema,
  parseBody,
} from "@/lib/server/api-schemas";
import { describeCreditPackage, validateCreditPackage } from "@/lib/credits";
import { toLocalDateString } from "@/lib/schedule";

/**
 * Sell a prepaid credit package: a draft invoice with one line, plus the
 * package behind it. The credits can be used once the invoice is sent or
 * marked paid, through the usual billing flow.
 * Body: { studentId, credits, durationMinutes, priceCents, startsOn?, expiresOn? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseBody(
    creditPackageCreateSchema,
    await req.json().catch(() => null)
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  const request = {
    credits: body.credits,
    durationMinutes: body.durationMinutes,
    priceCents: body.priceCents,
    startsOn: body.startsOn ?? today,
    expiresOn: body.expiresOn || null,
  };
  const invalid = validateCreditPackage(request);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name, guardian_id")
    .eq("id", body.studentId)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (!student.guardian_id) {
    return NextResponse.json(
      { error: "Link this student to a family before selling credits" },
      { status: 400 }
    );
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      teacher_id: user.id,
      guardian_id: student.guardian_id,
      period_start: today,
      period_end: today,
      status: "draft",
      subtotal_cents: request.priceCents,
      currency: policy.currency,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) {
    return NextResponse.json(
      { error: invoiceError?.message ?? "Failed to create invoice" },
      { status: 500 }
    );
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    lesson_id: null,
    kind: "credit_package",
    description: `Prepaid ${describeCreditPackage(request.credits, request.durationMinutes)} - ${student.name}`,
    quantity: 1,
    unit_cents: request.priceCents,
    amount_cents: request.priceCents,
    sort_order: 0,
  });

  const { data: creditPackage, error: packageError } = itemError
    ? { data: null, error: itemError }
    : await supabase
        .from("credit_packages")
        .insert({
          teacher_id: user.id,
          student_id: student.id,
          invoice_id: invoice.id,
          credits: request.credits,
          duration_minutes: request.durationMinutes,
          price_cents: request.priceCents,
          starts_on: request.startsOn,
          expires_on: request.expiresOn,
        })
        .select("id")
        .single();

  if (packageError || !creditPackage) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json(
      { error: packageError?.message ?? "Failed to create package" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    packageId: creditPackage.id,
    invoiceId: invoice.id,
  });
}
