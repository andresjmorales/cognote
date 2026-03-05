import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    let studentPlanId: string | null = null;
    const supabase = createServiceClient();

    // First try to look up by raw token (dev/seed tokens)
    const { data: directMatch } = await supabase
      .from("student_plans")
      .select(
        `
        id,
        student_id,
        plan_id,
        due_date,
        students ( name ),
        plans (
          name, clef, key_signature, include_sharps, include_flats,
          measures_shown, questions_per_lesson, answer_choices, notes,
          plan_type, symbols, show_hints, key_sig_scale_mode, key_signatures
        )
      `
      )
      .eq("token", token)
      .single();

    if (directMatch) {
      return NextResponse.json({
        studentPlanId: directMatch.id,
        studentName: (directMatch.students as any)?.name ?? "Student",
        plan: directMatch.plans,
      });
    }

    // Try to decrypt as an encrypted token
    try {
      const payload = decryptToken(token);
      const { data: sp } = await supabase
        .from("student_plans")
        .select(
          `
          id,
          students ( name ),
          plans (
            name, clef, key_signature, include_sharps, include_flats,
            measures_shown, questions_per_lesson, answer_choices, notes,
            plan_type, symbols, show_hints, key_sig_scale_mode, key_signatures
          )
        `
        )
        .eq("student_id", payload.studentId)
        .eq("plan_id", payload.planId)
        .single();

      if (sp) {
        return NextResponse.json({
          studentPlanId: sp.id,
          studentName: (sp.students as any)?.name ?? "Student",
          plan: sp.plans,
        });
      }
    } catch {
      // Token decryption failed — that's fine, we'll return 404
    }

    return NextResponse.json({ error: "Practice link not found" }, { status: 404 });
  } catch (err) {
    console.error("Practice token resolution error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
