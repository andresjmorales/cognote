"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LICENSE_LABELS, type MusicLicenseCode } from "@/lib/sheet-music";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

const LICENSE_OPTIONS = Object.entries(LICENSE_LABELS) as [
  MusicLicenseCode,
  string,
][];

type Item = {
  id: string;
  title: string;
  composer: string;
  arranger: string;
  tags: string[];
  license_code: MusicLicenseCode;
  license_url: string | null;
  source: string;
  source_url: string | null;
  attribution: string;
  original_filename: string;
  byte_size: number;
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function MusicMetadataPanel({ item }: { item: Item }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/music/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          composer: form.get("composer"),
          arranger: form.get("arranger"),
          tags: form.get("tags"),
          license_code: form.get("license_code"),
          license_url: form.get("license_url"),
          source_url: form.get("source_url"),
          attribution: form.get("attribution"),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(json.error ?? "Save failed");
      } else {
        setMessage("Saved");
        setEditing(false);
        router.refresh();
      }
    } catch {
      setMessage("Save failed");
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this score from your library? Assignments will be removed.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/music/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/music");
      router.refresh();
    } else {
      setMessage("Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Metadata</h2>
        {!editing && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(true);
              setMessage(null);
            }}
          >
            Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <dl className="grid sm:grid-cols-2 gap-3">
          <MetaRow label="Title" value={item.title} />
          <MetaRow label="Composer" value={item.composer || "—"} />
          <MetaRow label="Arranger / editor" value={item.arranger || "—"} />
          <MetaRow
            label="Tags"
            value={item.tags.length > 0 ? item.tags.join(", ") : "—"}
          />
          <MetaRow
            label="License"
            value={LICENSE_LABELS[item.license_code] ?? item.license_code}
          />
          <MetaRow
            label="License URL"
            value={
              item.license_url ? (
                <a
                  href={item.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  {item.license_url}
                </a>
              ) : (
                "—"
              )
            }
          />
          <MetaRow
            label="Source"
            value={
              item.source_url ? (
                <>
                  {item.source} ·{" "}
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary"
                  >
                    {item.source_url}
                  </a>
                </>
              ) : (
                item.source
              )
            }
          />
          <MetaRow label="Attribution" value={item.attribution || "—"} />
          <MetaRow
            label="File"
            value={`${item.original_filename} (${Math.round(item.byte_size / 1024)} KB)`}
          />
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Title</label>
              <input
                name="title"
                required
                defaultValue={item.title}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Composer</label>
              <input
                name="composer"
                defaultValue={item.composer}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Arranger / editor
              </label>
              <input
                name="arranger"
                defaultValue={item.arranger}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Tags</label>
              <input
                name="tags"
                defaultValue={item.tags.join(", ")}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">License</label>
              <select
                name="license_code"
                defaultValue={item.license_code}
                className={fieldClass}
              >
                {LICENSE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">License URL</label>
              <input
                name="license_url"
                type="url"
                defaultValue={item.license_url ?? ""}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Source URL</label>
              <input
                name="source_url"
                type="url"
                defaultValue={item.source_url ?? ""}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Attribution</label>
              <input
                name="attribution"
                defaultValue={item.attribution}
                className={fieldClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Source provider: {item.source} · {item.original_filename} (
            {Math.round(item.byte_size / 1024)} KB)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setMessage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="error"
              disabled={busy}
              onClick={handleDelete}
            >
              Delete
            </Button>
            {message && <span className="text-sm text-muted">{message}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
