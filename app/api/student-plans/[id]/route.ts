import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Unassign a practice lesson from a student. If they have practice history the
 * row is kept (unassigned_at set); otherwise the assignment row is deleted.
 */
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

  const { data: studentPlan } = await supabase
    .from("student_plans")
    .select(
      "id, unassigned_at, students!inner ( teacher_id ), practice_sessions ( id )"
    )
    .eq("id", id)
    .single();

  if (!studentPlan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const student = studentPlan.students as unknown as { teacher_id: string };
  if (student.teacher_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (studentPlan.unassigned_at) {
    return NextResponse.json({ error: "Already unassigned" }, { status: 400 });
  }

  const sessions = studentPlan.practice_sessions as { id: string }[] | null;
  const hasHistory = (sessions?.length ?? 0) > 0;

  if (hasHistory) {
    const { error } = await supabase
      .from("student_plans")
      .update({ unassigned_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ archived: true });
  }

  const { error } = await supabase.from("student_plans").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ archived: false });
}
