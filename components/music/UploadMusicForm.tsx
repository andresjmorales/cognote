"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LICENSE_LABELS, type MusicLicenseCode } from "@/lib/sheet-music";

const LICENSE_OPTIONS = Object.entries(LICENSE_LABELS) as [
  MusicLicenseCode,
  string,
][];

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function UploadMusicForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setExistingId(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/music", { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        if (json.existingId) setExistingId(json.existingId);
        setBusy(false);
        return;
      }
      form.reset();
      setOpen(false);
      router.push(`/music/${json.item.id}`);
      router.refresh();
    } catch {
      setError("Upload failed");
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
      className="border border-border rounded-xl bg-surface p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Upload score</h2>
        <button
          type="button"
          className="text-sm text-muted hover:text-foreground cursor-pointer"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          File (PDF, MusicXML, or MXL)
        </label>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.musicxml,.xml,.mxl,application/pdf,application/xml,text/xml"
          className={fieldClass}
        />
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
        <p className="text-sm text-error">
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
