import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SHEET_MUSIC_BUCKET } from "@/lib/sheet-music";

export async function GET(
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

  const { data: item } = await supabase
    .from("music_library_items")
    .select("id, storage_path, mime_type, original_filename, title")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { data: blob, error } = await service.storage
    .from(SHEET_MUSIC_BUCKET)
    .download(item.storage_path);

  if (error || !blob) {
    console.error("music file download:", error);
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  const asDownload = req.nextUrl.searchParams.get("download") === "1";
  const buffer = Buffer.from(await blob.arrayBuffer());
  const headers = new Headers({
    "Content-Type": item.mime_type || "application/octet-stream",
    "Cache-Control": "private, no-store",
    "Content-Length": String(buffer.byteLength),
  });
  if (asDownload) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${item.original_filename.replace(/"/g, "")}"`
    );
  } else {
    headers.set(
      "Content-Disposition",
      `inline; filename="${item.original_filename.replace(/"/g, "")}"`
    );
  }

  return new NextResponse(buffer, { status: 200, headers });
}
