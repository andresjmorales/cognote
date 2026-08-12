"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LICENSE_LABELS, type MusicLicenseCode } from "@/lib/sheet-music";
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

const MAX_ATTEMPTS = 2;

export function UploadMusicForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function resetLocal() {
    setError(null);
    setExistingId(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setExistingId(null);

    const form = e.currentTarget;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Rebuild each attempt so a partially-consumed body cannot poison retries.
      const data = new FormData(form);
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
            setFileName(e.target.files?.[0]?.name ?? null);
            setError(null);
            setExistingId(null);
          }}
        />
        <div className="min-w-0 max-w-full">
          <button
            type="button"
            className={fieldClass + " w-auto cursor-pointer"}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose File
          </button>
          <p
            className="mt-1.5 min-w-0 text-sm text-muted truncate"
            title={fileName ?? undefined}
          >
            {fileName ?? "No file chosen"}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Title</label>
          <input name="title" className={fieldClass} placeholder="Optional (uses filename)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Composer</label>
          <input name="composer" className={fieldClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Arranger / editor</label>
          <input name="arranger" className={fieldClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Tags</label>
          <input
            name="tags"
            className={fieldClass}
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
