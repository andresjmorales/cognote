import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  SHEET_MUSIC_BUCKET,
  sha256Hex,
  storageObjectPath,
  type MusicLicenseCode,
} from "@/lib/sheet-music";
import { findIndexedResult } from "@/lib/music-sources";

const ALLOWED_HOSTS = new Set(["www.mutopiaproject.org", "mutopiaproject.org"]);

/**
 * Import an allow-listed discovery result (currently Mutopia PD/CC BY PDFs)
 * into the teacher's private library.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const resultId = typeof body?.resultId === "string" ? body.resultId : "";
  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }

  const result = findIndexedResult(resultId);
  if (!result) {
    return NextResponse.json({ error: "Unknown catalogue item" }, { status: 404 });
  }
  if (!result.import_allowed || !result.file_url || result.format !== "pdf") {
    return NextResponse.json(
      {
        error:
          "This item cannot be imported automatically. Open the source page and upload a file you have rights to use.",
      },
      { status: 400 }
    );
  }

  let fileUrl: URL;
  try {
    fileUrl = new URL(result.file_url);
  } catch {
    return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(fileUrl.hostname) || !fileUrl.pathname.endsWith(".pdf")) {
    return NextResponse.json({ error: "File host not allowed" }, { status: 400 });
  }

  const download = await fetch(result.file_url, {
    headers: {
      "User-Agent": "CogNote/1.0 (https://cognote.studio; teacher library import)",
    },
    redirect: "follow",
  });
  if (!download.ok) {
    console.error("Mutopia download failed:", download.status, result.file_url);
    return NextResponse.json(
      { error: "Could not download score from Mutopia" },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  if (buffer.byteLength < 100 || buffer.byteLength > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Downloaded file size invalid" }, { status: 400 });
  }
  // PDF magic
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    return NextResponse.json({ error: "Downloaded file is not a PDF" }, { status: 400 });
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
  const filename =
    fileUrl.pathname.split("/").pop()?.replace(/[^\w.\-]+/g, "_") || "score.pdf";
  const storage_path = storageObjectPath(user.id, itemId, filename);
  const license_code = result.license_code as MusicLicenseCode;

  const { error: uploadError } = await service.storage
    .from(SHEET_MUSIC_BUCKET)
    .upload(storage_path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("import upload:", uploadError);
    return NextResponse.json({ error: "Failed to store file" }, { status: 500 });
  }

  const { data: item, error: insertError } = await service
    .from("music_library_items")
    .insert({
      id: itemId,
      teacher_id: user.id,
      title: result.title,
      composer: result.composer,
      arranger: result.arranger ?? "",
      format: "pdf",
      original_filename: filename,
      storage_path,
      mime_type: "application/pdf",
      byte_size: buffer.byteLength,
      sha256: hash,
      tags: ["mutopia", ...(result.instrument ? [result.instrument.toLowerCase()] : [])],
      source: "mutopia",
      source_url: result.source_url,
      license_code,
      license_url: result.license_url ?? null,
      attribution: result.attribution ?? "",
    })
    .select("id, title")
    .single();

  if (insertError || !item) {
    console.error("import insert:", insertError);
    await service.storage.from(SHEET_MUSIC_BUCKET).remove([storage_path]);
    return NextResponse.json({ error: "Failed to save library item" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
