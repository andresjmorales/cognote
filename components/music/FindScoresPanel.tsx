"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { LICENSE_LABELS } from "@/lib/sheet-music";
import {
  ALL_SOURCES,
  SOURCE_LABELS,
  sourceLinkLabel,
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

const DEFAULT_SOURCES = new Set<MusicSourceId>(ALL_SOURCES);

export function FindScoresPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [results, setResults] = useState<SheetMusicSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Set<MusicSourceId>>(DEFAULT_SOURCES);
  const [importableOnly, setImportableOnly] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [style, setStyle] = useState("");

  function toggleSource(id: MusicSourceId) {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return next; // keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      params.set("sources", Array.from(sources).join(","));
      if (importableOnly) params.set("importable", "1");
      if (instrument.trim()) params.set("instrument", instrument.trim());
      if (style.trim()) params.set("style", style.trim());

      const res = await fetch(`/api/music/search?${params.toString()}`);
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
    try {
      const res = await fetch("/api/music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existingId) {
        showToast(`Already in library: ${data.existingTitle}`, "info");
        router.push(`/music/${data.existingId}`);
        return;
      }
      if (!res.ok) {
        showToast(data.error ?? "Import failed", "error");
        return;
      }
      router.push(`/music/${data.item.id}`);
      router.refresh();
    } catch {
      showToast("Import failed", "error");
    } finally {
      setImportingId(null);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Search free scores
      </Button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Search free scores</h2>
          <p className="text-xs text-muted mt-1">
            Mutopia PDFs and OpenScore Lieder MXL can be added to your library.
            OpenScore Quartets and IMSLP are browse links (MuseScore.com downloads
            may require a paid account — use GitHub MXL import when available).
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

      <form onSubmit={runSearch} className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
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
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {ALL_SOURCES.map((id) => (
            <label key={id} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.has(id)}
                onChange={() => toggleSource(id)}
              />
              {SOURCE_LABELS[id]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={importableOnly}
              onChange={(e) => setImportableOnly(e.target.checked)}
            />
            Importable only
          </label>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Instrument</label>
            <input
              className={`${fieldClass} w-36`}
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="piano, voice…"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Style / period</label>
            <input
              className={`${fieldClass} w-36`}
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Romantic…"
            />
          </div>
        </div>
      </form>

      {error && <p className="text-sm text-error">{error}</p>}

      {results && results.length === 0 && !error && (
        <p className="text-sm text-muted">No matches. Try another spelling or clear filters.</p>
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
                  {[
                    r.composer || null,
                    r.instrument || null,
                    r.key ? `Key ${r.key}` : null,
                    r.style || null,
                    r.format === "external" ? null : r.format.toUpperCase(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <SourceBadge source={r.source} />
                  <LicenseBadge code={r.license_code} />
                  {r.import_allowed ? (
                    <span className="inline-flex items-center rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                      Can add
                    </span>
                  ) : (
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
                  {sourceLinkLabel(r.source)}
                </a>
                {r.github_url && r.source.startsWith("openscore") && (
                  <a
                    href={r.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center font-semibold bg-surface border border-border text-foreground hover:border-primary/50 px-3 py-1.5 text-xs rounded-lg transition-colors"
                  >
                    View on GitHub
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">
        OpenScore Lieder MXL is fetched from the public GitHub corpus (CC0) so
        families can view it in CogNote without a MuseScore.com download. Exporting
        an engraved PDF from MXL is a future enhancement.
      </p>
    </Card>
  );
}
