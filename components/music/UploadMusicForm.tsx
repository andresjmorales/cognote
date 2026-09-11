"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LICENSE_LABELS, type MusicLicenseCode } from "@/lib/sheet-music";
import {
  applySuggestion,
  filenameToQuery,
  type MetadataSuggestion,
  type UploadMetadata,
} from "@/lib/music-metadata";
import { MetadataSuggestInput } from "@/components/music/MetadataSuggestInput";
import {
  isRetryableUploadStatus,
  messageFromUploadResponse,
} from "@/lib/upload-errors";

const LICENSE_OPTIONS = Object.entries(LICENSE_LABELS) as [
  MusicLicenseCode,
  string,
][];

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

/** Preview tint, matching the browser-autofill convention of a tinted field. */
const previewClass = "border-primary bg-primary/5 text-muted italic";

const MAX_ATTEMPTS = 2;

const EMPTY_METADATA: UploadMetadata = {
  title: "",
  composer: "",
  arranger: "",
  tags: "",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function UploadMusicForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [meta, setMeta] = useState<UploadMetadata>(EMPTY_METADATA);
  const [preview, setPreview] = useState<MetadataSuggestion | null>(null);
  const [applied, setApplied] = useState<
    { label: string; previous: UploadMetadata } | null
  >(null);

  // What the fields render: the committed values, with any hovered suggestion
  // laid over them.
  const shown = applySuggestion(meta, preview);
  const isPreview = (key: keyof UploadMetadata) => shown[key] !== meta[key];

  function setField(key: keyof UploadMetadata, value: string) {
    setApplied(null);
    setMeta((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply(suggestion: MetadataSuggestion) {
    setPreview(null);
    setApplied({ label: suggestion.sourceLabel, previous: meta });
    setMeta(applySuggestion(meta, suggestion));
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetLocal() {
    setError(null);
    setExistingId(null);
    setMeta(EMPTY_METADATA);
    setPreview(null);
    setApplied(null);
    clearFile();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setExistingId(null);
    setPreview(null);

    const form = e.currentTarget;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Rebuild each attempt so a partially-consumed body cannot poison retries.
      const data = new FormData(form);
      // Send committed values, never a suggestion that is only being previewed.
      data.set("title", meta.title);
      data.set("composer", meta.composer);
      data.set("arranger", meta.arranger);
      data.set("tags", meta.tags);
      try {
        const res = await fetch("/api/music", { method: "POST", body: data });
        if (!res.ok) {
          const { message, existingId: id } = await messageFromUploadResponse(res);
          if (id) setExistingId(id);
          if (
            attempt < MAX_ATTEMPTS &&
            !id &&
            isRetryableUploadStatus(res.status)
          ) {
            continue;
          }
          setError(message);
          setBusy(false);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as {
          item?: { id: string };
        };
        if (!json.item?.id) {
          setError("Upload succeeded but the response was incomplete. Refresh the library.");
          setBusy(false);
          return;
        }
        form.reset();
        resetLocal();
        setOpen(false);
        router.push(`/music/${json.item.id}`);
        router.refresh();
        setBusy(false);
        return;
      } catch {
        if (attempt < MAX_ATTEMPTS) continue;
        setError(
          "Network error while uploading. Check your connection and try again."
        );
        setBusy(false);
        return;
      }
    }

    setBusy(false);
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Upload score
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border rounded-xl bg-surface p-4 space-y-3 w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Upload score</h2>
        <button
          type="button"
          className="text-sm text-muted hover:text-foreground cursor-pointer"
          onClick={() => {
            setOpen(false);
            resetLocal();
          }}
        >
          Cancel
        </button>
      </div>

      <div>
        <label
          htmlFor="music-upload-file"
          className="block text-xs font-medium text-muted mb-1"
        >
          File (PDF, MusicXML, or MXL)
        </label>
        {/*
          Hide the native file control: Safari iOS often shows a solid black
          square as the PDF thumbnail next to the filename, which looks like a
          broken icon/emoji. Custom chrome keeps the label readable.
        */}
        <input
          ref={fileInputRef}
          id="music-upload-file"
          name="file"
          type="file"
          required
          accept=".pdf,.musicxml,.xml,.mxl,application/pdf,application/xml,text/xml"
          className="sr-only"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            setFile(picked ? { name: picked.name, size: picked.size } : null);
            setError(null);
            setExistingId(null);
          }}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              file
                ? "border-border bg-surface text-muted hover:text-foreground"
                : "border-border bg-surface-dim hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? "Change file" : "Choose file"}
          </button>

          {file ? (
            <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5 text-sm">
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10.5 8 14.5 16 6" />
              </svg>
              <span className="min-w-0 truncate font-medium" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 cursor-pointer rounded px-1 text-muted hover:text-foreground"
              >
                ×
              </button>
            </span>
          ) : (
            <span className="text-sm text-muted">No file chosen</span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {preview ? (
          <>Preview — press Enter or click to fill these fields.</>
        ) : applied ? (
          <>
            Filled from {applied.label}.{" "}
            <button
              type="button"
              className="cursor-pointer underline hover:text-foreground"
              onClick={() => {
                setMeta(applied.previous);
                setApplied(null);
              }}
            >
              Undo
            </button>
          </>
        ) : (
          <>Start typing a title or composer for catalogue suggestions.</>
        )}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="music-upload-title"
            className="block text-xs font-medium text-muted mb-1"
          >
            Title
          </label>
          <MetadataSuggestInput
            id="music-upload-title"
            field="title"
            name="title"
            ariaLabel="Title"
            value={meta.title}
            displayValue={shown.title}
            previewing={isPreview("title")}
            onValueChange={(v) => setField("title", v)}
            onPreview={setPreview}
            onApply={handleApply}
            fallbackQuery={file ? filenameToQuery(file.name) : undefined}
            placeholder="Optional (uses filename)"
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="music-upload-composer"
            className="block text-xs font-medium text-muted mb-1"
          >
            Composer
          </label>
          <MetadataSuggestInput
            id="music-upload-composer"
            field="composer"
            name="composer"
            ariaLabel="Composer"
            value={meta.composer}
            displayValue={shown.composer}
            previewing={isPreview("composer")}
            onValueChange={(v) => setField("composer", v)}
            onPreview={setPreview}
            onApply={handleApply}
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="music-upload-arranger"
            className="block text-xs font-medium text-muted mb-1"
          >
            Arranger / editor
          </label>
          <input
            id="music-upload-arranger"
            name="arranger"
            value={shown.arranger}
            onChange={(e) => setField("arranger", e.target.value)}
            className={`${fieldClass} ${isPreview("arranger") ? previewClass : ""}`}
          />
        </div>
        <div>
          <label
            htmlFor="music-upload-tags"
            className="block text-xs font-medium text-muted mb-1"
          >
            Tags
          </label>
          <input
            id="music-upload-tags"
            name="tags"
            value={shown.tags}
            onChange={(e) => setField("tags", e.target.value)}
            className={`${fieldClass} ${isPreview("tags") ? previewClass : ""}`}
            placeholder="sonatina, grade 3, recital"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">License</label>
          <select name="license_code" defaultValue="teacher_owned" className={fieldClass}>
            {LICENSE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">License URL</label>
          <input name="license_url" type="url" className={fieldClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Source URL</label>
          <input name="source_url" type="url" className={fieldClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Attribution</label>
          <input
            name="attribution"
            className={fieldClass}
            placeholder="Required credit text, if any"
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        By uploading, you confirm you have the right to share this score with your
        assigned students. Uploads stay private to your studio.
      </p>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
          {existingId && (
            <>
              {" "}
              <Link href={`/music/${existingId}`} className="underline">
                Open existing item
              </Link>
            </>
          )}
        </p>
      )}

      <Button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Add to library"}
      </Button>
    </form>
  );
}
