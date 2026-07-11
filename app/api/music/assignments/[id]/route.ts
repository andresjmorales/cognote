import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  const service = createServiceClient();
  const { data: assignment } = await service
    .from("sheet_music_assignments")
    .select(
      "id, unassigned_at, music_library_items!inner ( teacher_id )"
    )
    .eq("id", id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const teacherId = (
    assignment.music_library_items as unknown as { teacher_id: string }
  ).teacher_id;
  if (teacherId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (assignment.unassigned_at) {
    return NextResponse.json({ ok: true, alreadyUnassigned: true });
  }

  const { error } = await service
    .from("sheet_music_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("sheet music unassign:", error);
    return NextResponse.json({ error: "Failed to unassign" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
