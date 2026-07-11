import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { SHEET_MUSIC_BUCKET } from "@/lib/sheet-music";

/**
 * Portal-authorized score file. Validates the portal token's family owns the
 * student on an active assignment before streaming from private storage.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; assignmentId: string }> }
) {
  const { token, assignmentId } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, students ( id )")
    .eq("portal_token", token)
    .maybeSingle();

  if (!guardian) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const studentIds = new Set(
    ((guardian.students ?? []) as { id: string }[]).map((s) => s.id)
  );

  const { data: assignment } = await supabase
    .from("sheet_music_assignments")
    .select(
      `
      id, student_id, unassigned_at,
      music_library_items (
        storage_path, mime_type, original_filename, title
      )
    `
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (
    !assignment ||
    assignment.unassigned_at ||
    !studentIds.has(assignment.student_id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = assignment.music_library_items as unknown as {
    storage_path: string;
    mime_type: string;
    original_filename: string;
    title: string;
  } | null;

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: blob, error } = await supabase.storage
    .from(SHEET_MUSIC_BUCKET)
    .download(item.storage_path);

  if (error || !blob) {
    console.error("portal music file:", error);
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  const asDownload = req.nextUrl.searchParams.get("download") === "1";
  const buffer = Buffer.from(await blob.arrayBuffer());
  const headers = new Headers({
    "Content-Type": item.mime_type || "application/octet-stream",
    "Cache-Control": "private, no-store",
    "Content-Length": String(buffer.byteLength),
  });
  const filename = item.original_filename.replace(/"/g, "");
  headers.set(
    "Content-Disposition",
    `${asDownload ? "attachment" : "inline"}; filename="${filename}"`
  );

  return new NextResponse(buffer, { status: 200, headers });
}
