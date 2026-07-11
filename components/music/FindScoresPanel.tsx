"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LICENSE_LABELS } from "@/lib/sheet-music";
import {
  SOURCE_LABELS,
  type MusicSourceId,
  type SheetMusicSearchResult,
} from "@/lib/music-sources";

const fieldClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function LicenseBadge({ code }: { code: SheetMusicSearchResult["license_code"] }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-dim px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {LICENSE_LABELS[code] ?? code}
    </span>
  );
}

function SourceBadge({ source }: { source: MusicSourceId }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function FindScoresPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [results, setResults] = useState<SheetMusicSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setResults([]);
      } else {
        setResults(data.results ?? []);
      }
    } catch {
      setError("Search failed");
      setResults([]);
    }
    setBusy(false);
  }

  async function handleImport(result: SheetMusicSearchResult) {
    setImportingId(result.id);
    setToast(null);
    try {
      const res = await fetch("/api/music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existingId) {
        setToast(`Already in library: ${data.existingTitle}`);
        router.push(`/music/${data.existingId}`);
        return;
      }
      if (!res.ok) {
        setToast(data.error ?? "Import failed");
        setTimeout(() => setToast(null), 4000);
        return;
      }
      router.push(`/music/${data.item.id}`);
      router.refresh();
    } catch {
      setToast("Import failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setImportingId(null);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Find free scores
      </Button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Find free scores</h2>
          <p className="text-xs text-muted mt-1">
            Search Mutopia (importable PD/CC BY PDFs), OpenScore (CC0 — open on
            MuseScore.com), and IMSLP (external link only). Your private uploads
            stay private.
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-muted hover:text-foreground cursor-pointer shrink-0"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <form onSubmit={runSearch} className="flex flex-wrap gap-2 items-center">
        <input
          className={`${fieldClass} flex-1 min-w-[12rem]`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Composer or title…"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-error">{error}</p>}

      {results && results.length === 0 && !error && (
        <p className="text-sm text-muted">No matches. Try another spelling.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{r.title}</div>
                <div className="text-xs text-muted mt-0.5">
                  {[r.composer || null, r.instrument || null, r.format.toUpperCase()]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <SourceBadge source={r.source} />
                  <LicenseBadge code={r.license_code} />
                  {!r.import_allowed && (
                    <span className="inline-flex items-center rounded-md bg-warning/20 px-1.5 py-0.5 text-[11px] font-medium">
                      Link only
                    </span>
                  )}
                </div>
                {r.attribution && (
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">
                    {r.attribution}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {r.import_allowed ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={importingId === r.id}
                    onClick={() => handleImport(r)}
                  >
                    {importingId === r.id ? "Adding…" : "Add to library"}
                  </Button>
                ) : null}
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center font-semibold bg-surface border border-border text-foreground hover:border-primary/50 px-3 py-1.5 text-xs rounded-lg transition-colors"
                >
                  Open source
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">
        OpenScore GitHub stores MuseScore source, not MusicXML — open the MuseScore
        page to download MusicXML/PDF, then upload here.{" "}
        <Link href="https://www.mutopiaproject.org/legal.html" className="underline" target="_blank">
          Mutopia legal
        </Link>
      </p>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </Card>
  );
}
