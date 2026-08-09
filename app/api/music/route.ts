import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  SHEET_MUSIC_BUCKET,
  parseTags,
  sha256Hex,
  storageObjectPath,
  validateMusicUpload,
  validateMusicContent,
  type MusicLicenseCode,
} from "@/lib/sheet-music";

const LICENSE_CODES = new Set<MusicLicenseCode>([
  "public_domain",
  "cc0",
  "cc_by",
  "cc_by_sa",
  "teacher_owned",
  "unknown",
  "restricted",
]);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const format = req.nextUrl.searchParams.get("format");
  const tag = req.nextUrl.searchParams.get("tag")?.trim().toLowerCase() ?? "";

  let query = supabase
    .from("music_library_items")
    .select(
      `
      id, title, composer, arranger, format, tags, license_code, source,
      original_filename, byte_size, created_at, attribution,
      sheet_music_assignments ( id, student_id, unassigned_at, students ( id, name ) )
    `
    )
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (format === "pdf" || format === "musicxml" || format === "mxl") {
    query = query.eq("format", format);
  }

  const { data, error } = await query;
  if (error) {
    console.error("music library list:", error);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }

  let items = data ?? [];
  if (q) {
    items = items.filter((item) => {
      const hay = `${item.title} ${item.composer} ${item.arranger} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (tag) {
    items = items.filter((item) => (item.tags ?? []).includes(tag));
  }

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    assertWithinHostedLimit,
    limitReachedResponse,
  } = await import("@/lib/server/entitlements");
  const sheetLimit = await assertWithinHostedLimit(
    supabase,
    user.id,
    "sheet_music"
  );
  if (!sheetLimit.allowed) {
    return NextResponse.json(limitReachedResponse(sheetLimit), { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const validation = validateMusicUpload(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
  const composer = String(form.get("composer") ?? "").trim();
  const arranger = String(form.get("arranger") ?? "").trim();
  const attribution = String(form.get("attribution") ?? "").trim();
  const sourceUrl = String(form.get("source_url") ?? "").trim() || null;
  const licenseUrl = String(form.get("license_url") ?? "").trim() || null;
  const tags = parseTags(String(form.get("tags") ?? ""));
  const licenseRaw = String(form.get("license_code") ?? "teacher_owned") as MusicLicenseCode;
  const license_code = LICENSE_CODES.has(licenseRaw) ? licenseRaw : "teacher_owned";

  const buffer = Buffer.from(await file.arrayBuffer());

  const content = validateMusicContent(validation.format, buffer);
  if (!content.ok) {
    return NextResponse.json({ error: content.error }, { status: 400 });
  }

  const hash = sha256Hex(buffer);

  const service = createServiceClient();
  const { data: existing } = await service
    .from("music_library_items")
    .select("id, title")
    .eq("teacher_id", user.id)
    .eq("sha256", hash)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: "This file is already in your library",
        existingId: existing.id,
        existingTitle: existing.title,
      },
      { status: 409 }
    );
  }

  const itemId = crypto.randomUUID();
  const storage_path = storageObjectPath(user.id, itemId, file.name);
  const mime_type =
    file.type ||
    (validation.format === "pdf"
      ? "application/pdf"
      : validation.format === "mxl"
        ? "application/vnd.recordare.musicxml"
        : "application/xml");

  const { error: uploadError } = await service.storage
    .from(SHEET_MUSIC_BUCKET)
    .upload(storage_path, buffer, {
      contentType: mime_type,
      upsert: false,
    });

  if (uploadError) {
    console.error("sheet music upload:", uploadError);
    return NextResponse.json({ error: "Failed to store file" }, { status: 500 });
  }

  const { data: item, error: insertError } = await service
    .from("music_library_items")
    .insert({
      id: itemId,
      teacher_id: user.id,
      title,
      composer,
      arranger,
      format: validation.format,
      original_filename: file.name,
      storage_path,
      mime_type,
      byte_size: buffer.byteLength,
      sha256: hash,
      tags,
      source: "teacher_upload",
      source_url: sourceUrl,
      license_code,
      license_url: licenseUrl,
      attribution,
    })
    .select("id, title, format")
    .single();

  if (insertError) {
    console.error("music library insert:", insertError);
    await service.storage.from(SHEET_MUSIC_BUCKET).remove([storage_path]);
    return NextResponse.json({ error: "Failed to save library item" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
