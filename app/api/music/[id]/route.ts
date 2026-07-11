import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  LICENSE_LABELS,
  parseTags,
  type MusicLicenseCode,
} from "@/lib/sheet-music";
import { SHEET_MUSIC_BUCKET } from "@/lib/sheet-music";

const LICENSE_CODES = new Set(Object.keys(LICENSE_LABELS) as MusicLicenseCode[]);

export async function PATCH(
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

  const body = await req.json();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    updates.title = title;
  }
  if (typeof body.composer === "string") updates.composer = body.composer.trim();
  if (typeof body.arranger === "string") updates.arranger = body.arranger.trim();
  if (typeof body.attribution === "string") {
    updates.attribution = body.attribution.trim();
  }
  if (typeof body.source_url === "string") {
    updates.source_url = body.source_url.trim() || null;
  }
  if (typeof body.license_url === "string") {
    updates.license_url = body.license_url.trim() || null;
  }
  if (typeof body.tags === "string") {
    updates.tags = parseTags(body.tags);
  } else if (Array.isArray(body.tags)) {
    updates.tags = parseTags(body.tags.join(","));
  }
  if (typeof body.license_code === "string" && LICENSE_CODES.has(body.license_code)) {
    updates.license_code = body.license_code;
  }

  const { data, error } = await supabase
    .from("music_library_items")
    .update(updates)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("music patch:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

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

  const { data: item } = await supabase
    .from("music_library_items")
    .select("id, storage_path")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("music_library_items")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("music delete:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  await service.storage.from(SHEET_MUSIC_BUCKET).remove([item.storage_path]);

  return NextResponse.json({ ok: true });
}
