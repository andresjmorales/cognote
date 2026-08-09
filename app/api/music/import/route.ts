import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  SHEET_MUSIC_BUCKET,
  sha256Hex,
  storageObjectPath,
  type MusicLicenseCode,
  type MusicFormat,
} from "@/lib/sheet-music";
import { findIndexedResult } from "@/lib/music-sources";

const ALLOWED_HOSTS = new Set([
  "www.mutopiaproject.org",
  "mutopiaproject.org",
  "raw.githubusercontent.com",
]);

function isZipMxl(buffer: Buffer): boolean {
  // MXL is a ZIP container; PK\x03\x04
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Download with every redirect hop re-validated against the host allowlist,
 * so an allow-listed origin can never bounce the request to an internal or
 * attacker-controlled URL.
 */
async function fetchFromAllowedHosts(startUrl: string): Promise<Response | null> {
  const MAX_REDIRECTS = 4;
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return null;
    }
    const res = await fetch(current, {
      headers: {
        "User-Agent": "CogNote/1.0 (https://cognote.studio; teacher library import)",
      },
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return null;
}

/**
 * Import an allow-listed discovery result into the teacher's private library.
 * Currently: Mutopia PD/CC BY PDFs, OpenScore Lieder MXL (CC0 from GitHub).
 */
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

  const body = await req.json().catch(() => null);
  const resultId = typeof body?.resultId === "string" ? body.resultId : "";
  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }

  const result = findIndexedResult(resultId);
  if (!result) {
    return NextResponse.json({ error: "Unknown catalogue item" }, { status: 404 });
  }
  if (
    !result.import_allowed ||
    !result.file_url ||
    (result.format !== "pdf" && result.format !== "mxl")
  ) {
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

  const pathLower = fileUrl.pathname.toLowerCase();
  const expectPdf = result.format === "pdf";
  const expectMxl = result.format === "mxl";
  if (!ALLOWED_HOSTS.has(fileUrl.hostname)) {
    return NextResponse.json({ error: "File host not allowed" }, { status: 400 });
  }
  if (expectPdf && !pathLower.endsWith(".pdf")) {
    return NextResponse.json({ error: "Expected a PDF URL" }, { status: 400 });
  }
  if (expectMxl) {
    if (fileUrl.hostname !== "raw.githubusercontent.com") {
      return NextResponse.json({ error: "MXL host not allowed" }, { status: 400 });
    }
    if (!pathLower.includes("/openscore/") || !pathLower.endsWith(".mxl")) {
      return NextResponse.json({ error: "Expected an OpenScore MXL URL" }, { status: 400 });
    }
  }

  const download = await fetchFromAllowedHosts(result.file_url);
  if (!download || !download.ok) {
    console.error("score download failed:", download?.status, result.file_url);
    return NextResponse.json(
      { error: "Could not download score file" },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  if (buffer.byteLength < 50 || buffer.byteLength > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Downloaded file size invalid" }, { status: 400 });
  }

  if (expectPdf && buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    return NextResponse.json({ error: "Downloaded file is not a PDF" }, { status: 400 });
  }
  if (expectMxl && !isZipMxl(buffer)) {
    return NextResponse.json(
      { error: "Downloaded file is not a valid MXL (ZIP) archive" },
      { status: 400 }
    );
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
  const defaultName = expectPdf ? "score.pdf" : "score.mxl";
  const filename =
    fileUrl.pathname.split("/").pop()?.replace(/[^\w.\-]+/g, "_") || defaultName;
  const storage_path = storageObjectPath(user.id, itemId, filename);
  const license_code = result.license_code as MusicLicenseCode;
  const format = result.format as MusicFormat;
  const mime_type = expectPdf
    ? "application/pdf"
    : "application/vnd.recordare.musicxml";

  const { error: uploadError } = await service.storage
    .from(SHEET_MUSIC_BUCKET)
    .upload(storage_path, buffer, {
      contentType: mime_type,
      upsert: false,
    });

  if (uploadError) {
    console.error("import upload:", uploadError);
    return NextResponse.json({ error: "Failed to store file" }, { status: 500 });
  }

  const sourceTag =
    result.source === "mutopia"
      ? "mutopia"
      : result.source === "openscore-lieder"
        ? "openscore-lieder"
        : result.source === "openscore-quartets"
          ? "openscore-quartets"
          : result.source;

  const { data: item, error: insertError } = await service
    .from("music_library_items")
    .insert({
      id: itemId,
      teacher_id: user.id,
      title: result.title,
      composer: result.composer,
      arranger: result.arranger ?? "",
      format,
      original_filename: filename,
      storage_path,
      mime_type,
      byte_size: buffer.byteLength,
      sha256: hash,
      tags: [
        sourceTag,
        ...(result.instrument
          ? result.instrument
              .toLowerCase()
              .split(/[,;/]+/)
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 4)
          : []),
      ],
      source: sourceTag,
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
