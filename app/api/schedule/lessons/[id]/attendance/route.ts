import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["attended", "teacher_cancel", "student_cancel", "no_show"];

/**
 * Mark or clear attendance for a lesson. Attendance rows record facts
 * (status + when notice was given); whether a cancellation is "late" or
 * earns a make-up credit is derived from studio_policies at read time (§3).
 */
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

  // Ownership check via RLS-scoped read
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.status === null) {
    const { error } = await supabase.from("attendance").delete().eq("lesson_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        lesson_id: id,
        status: body.status,
        notice_at:
          body.status === "student_cancel"
            ? (body.noticeAt ?? new Date().toISOString())
            : null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
