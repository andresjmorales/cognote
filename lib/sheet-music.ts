import { createHash } from "crypto";

export const SHEET_MUSIC_BUCKET = "sheet-music";
/** Soft cap under the 50MiB storage bucket limit. */
export const SHEET_MUSIC_MAX_BYTES = 25 * 1024 * 1024;

export type MusicFormat = "pdf" | "musicxml" | "mxl";

export type MusicLicenseCode =
  | "public_domain"
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "teacher_owned"
  | "unknown"
  | "restricted";

export const LICENSE_LABELS: Record<MusicLicenseCode, string> = {
  public_domain: "Public Domain",
  cc0: "CC0",
  cc_by: "CC BY",
  cc_by_sa: "CC BY-SA",
  teacher_owned: "Teacher-owned / licensed",
  unknown: "Unknown",
  restricted: "Restricted",
};

const EXT_TO_FORMAT: Record<string, MusicFormat> = {
  pdf: "pdf",
  musicxml: "musicxml",
  xml: "musicxml",
  mxl: "mxl",
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/xml",
  "text/xml",
  "application/vnd.recordare.musicxml+xml",
  "application/vnd.recordare.musicxml",
  "application/zip",
  "application/octet-stream",
]);

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function formatFromFilename(filename: string): MusicFormat | null {
  return EXT_TO_FORMAT[extensionOf(filename)] ?? null;
}

export function sanitizeFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? "score").trim() || "score";
  return base
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 180);
}

export function validateMusicUpload(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true; format: MusicFormat } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: "File is empty" };
  }
  if (file.size > SHEET_MUSIC_MAX_BYTES) {
    return {
      ok: false,
      error: `File exceeds ${SHEET_MUSIC_MAX_BYTES / (1024 * 1024)}MB limit`,
    };
  }
  const format = formatFromFilename(file.name);
  if (!format) {
    return {
      ok: false,
      error: "Only PDF, MusicXML (.musicxml/.xml), and MXL files are allowed",
    };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    // Browsers often send odd MIME for .mxl/.musicxml — extension is authoritative.
    if (format === "pdf" && file.type !== "application/pdf") {
      return { ok: false, error: "PDF uploads must be application/pdf" };
    }
  }
  return { ok: true, format };
}

/**
 * Content sniffing for uploaded score files. Extensions and browser MIME
 * types are user-controlled; the stored bytes must actually match the
 * declared format.
 */
export function validateMusicContent(
  format: MusicFormat,
  buffer: Buffer
): { ok: true } | { ok: false; error: string } {
  if (format === "pdf") {
    if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      return { ok: false, error: "File does not look like a PDF" };
    }
    return { ok: true };
  }
  if (format === "mxl") {
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;
    if (!isZip) {
      return { ok: false, error: "File does not look like an MXL (ZIP) archive" };
    }
    return { ok: true };
  }
  // MusicXML: text file whose first non-whitespace character (after an
  // optional UTF-8 BOM) opens an XML tag.
  let start = 0;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    start = 3;
  }
  const head = buffer.subarray(start, start + 256).toString("utf8").trimStart();
  if (!head.startsWith("<")) {
    return { ok: false, error: "File does not look like a MusicXML document" };
  }
  return { ok: true };
}

export function sha256Hex(buffer: ArrayBuffer | Uint8Array | Buffer): string {
  const bytes = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
  return createHash("sha256").update(bytes).digest("hex");
}

export function storageObjectPath(
  teacherId: string,
  itemId: string,
  originalFilename: string
): string {
  return `${teacherId}/${itemId}/${sanitizeFilename(originalFilename)}`;
}

export function isActiveSheetMusicAssignment(row: {
  unassigned_at: string | null;
}): boolean {
  return row.unassigned_at == null;
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const tag = part.trim().toLowerCase().slice(0, 40);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
}

export function formatLabel(format: MusicFormat): string {
  if (format === "pdf") return "PDF";
  if (format === "mxl") return "MXL";
  return "MusicXML";
}
