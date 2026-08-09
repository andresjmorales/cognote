import type { MusicLicenseCode } from "@/lib/sheet-music";
import openscoreLieder from "@/lib/music-indexes/openscore-lieder.json";
import openscoreQuartets from "@/lib/music-indexes/openscore-quartets.json";
import mutopia from "@/lib/music-indexes/mutopia.json";

export type MusicSourceId =
  | "openscore-lieder"
  | "openscore-quartets"
  | "mutopia"
  | "imslp";

export type SearchResultFormat = "pdf" | "musicxml" | "mxl" | "external";

export interface SheetMusicSearchResult {
  id: string;
  source: MusicSourceId;
  title: string;
  composer: string;
  arranger?: string;
  format: SearchResultFormat;
  license_code: MusicLicenseCode;
  license_url?: string | null;
  source_url: string;
  /** Direct GitHub blob/raw page when relevant (OpenScore). */
  github_url?: string | null;
  file_url?: string | null;
  import_allowed: boolean;
  attribution?: string;
  instrument?: string;
  style?: string;
  key?: string;
  librettist?: string;
  external_only?: boolean;
}

export interface MusicSearchFilters {
  sources?: MusicSourceId[];
  /** Only results that can be one-click imported into the library. */
  importableOnly?: boolean;
  /** Substring match against instrument field (e.g. "piano"). */
  instrument?: string;
  /** Substring match against style/period when present. */
  style?: string;
}

export const SOURCE_LABELS: Record<MusicSourceId, string> = {
  "openscore-lieder": "OpenScore Lieder",
  "openscore-quartets": "OpenScore Quartets",
  mutopia: "Mutopia",
  imslp: "IMSLP",
};

export const ALL_SOURCES: MusicSourceId[] = [
  "mutopia",
  "openscore-lieder",
  "openscore-quartets",
  "imslp",
];

type IndexedRow = SheetMusicSearchResult & Record<string, unknown>;

const STATIC_INDEXES: IndexedRow[] = [
  ...(openscoreLieder as IndexedRow[]),
  ...(openscoreQuartets as IndexedRow[]),
  ...(mutopia as IndexedRow[]),
];

function scoreMatch(hay: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    if (!hay.includes(term)) return -1;
    score += hay.startsWith(term) ? 3 : 1;
    if (hay.includes(` ${term}`)) score += 1;
  }
  return score;
}

function toResult(row: IndexedRow): SheetMusicSearchResult {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    composer: row.composer,
    arranger: row.arranger,
    format: row.format,
    license_code: row.license_code,
    license_url: row.license_url,
    source_url: row.source_url,
    github_url: row.github_url,
    file_url: row.file_url,
    import_allowed: row.import_allowed,
    attribution: row.attribution,
    instrument: row.instrument,
    style: row.style,
    key: row.key,
    librettist: row.librettist,
    external_only: row.external_only,
  };
}

function matchesFilters(
  item: SheetMusicSearchResult,
  filters?: MusicSearchFilters
): boolean {
  if (!filters) return true;
  if (filters.importableOnly && !item.import_allowed) return false;
  if (filters.instrument) {
    const needle = filters.instrument.toLowerCase();
    if (!(item.instrument ?? "").toLowerCase().includes(needle)) return false;
  }
  if (filters.style) {
    const needle = filters.style.toLowerCase();
    if (!(item.style ?? "").toLowerCase().includes(needle)) return false;
  }
  return true;
}

export function searchStaticIndexes(
  query: string,
  filters?: MusicSearchFilters
): SheetMusicSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const allow = filters?.sources?.length ? new Set(filters.sources) : null;

  const scored: { score: number; item: SheetMusicSearchResult }[] = [];

  for (const row of STATIC_INDEXES) {
    if (allow && !allow.has(row.source)) continue;
    const hay =
      `${row.title} ${row.composer} ${row.arranger ?? ""} ${row.instrument ?? ""} ${row.style ?? ""}`.toLowerCase();
    const score = scoreMatch(hay, terms);
    if (score < 0) continue;
    const item = toResult(row);
    if (!matchesFilters(item, filters)) continue;
    scored.push({ score, item });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)
  );
  return scored.map((s) => s.item);
}

export function findIndexedResult(id: string): SheetMusicSearchResult | null {
  const row = STATIC_INDEXES.find((r) => r.id === id);
  return row ? toResult(row) : null;
}

function parseImslpTitle(title: string): { title: string; composer: string } {
  const m = title.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (!m) return { title, composer: "" };
  return { title: m[1], composer: m[2] };
}

/** Strip IMSLP/MediaWiki markup from a single field value for display. */
export function cleanImslpFieldValue(raw: string): string | undefined {
  let value = raw.trim();
  if (!value) return undefined;

  // HTML line breaks / tags → readable separators
  value = value.replace(/<\s*br\s*\/?\s*>/gi, "; ");
  value = value.replace(/<\/?[a-z][^>]*>/gi, " ");

  // Common IMSLP templates (may contain pipes — expand before stripping)
  value = value.replace(/\{\{\s*Key\s*\|\s*([^}|]+)\s*\}\}/gi, (_, k: string) => {
    const t = k.trim();
    if (!t) return "";
    // IMSLP convention: lowercase letter ≈ minor, uppercase ≈ major
    if (/^[a-g](#|b)?$/i.test(t) && t === t.toLowerCase()) {
      return `${t.toUpperCase()} minor`;
    }
    return `${t} major`;
  });
  value = value.replace(
    /\{\{\s*LinkLib\s*\|\s*([^}|]+)\s*\|\s*([^}|]+)[^}]*\}\}/gi,
    "$1 $2"
  );
  value = value.replace(
    /\{\{\s*LinkEd\s*\|\s*[^}|]*\|\s*([^}|]+)[^}]*\}\}/gi,
    "$1"
  );

  // Remaining templates: drop nested {{...}} greedily from inside out
  for (let i = 0; i < 8; i++) {
    const next = value.replace(/\{\{[^{}]*\}\}/g, " ");
    if (next === value) break;
    value = next;
  }
  // Incomplete / orphan template crumbs (e.g. "{{Key" from a truncated parse)
  value = value.replace(/\{\{+[^{}]*/g, " ");
  value = value.replace(/\}+/g, " ");
  value = value.replace(/\|+/g, " ");

  // Wiki links
  value = value.replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, "$1");
  value = value.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Decode exactly one entity level in a single pass: a lookup-map replace
  // cannot re-decode its own output, so `&amp;lt;` becomes `&lt;`, not `<`.
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
  };
  value = value.replace(
    /&(?:nbsp|lt|gt|amp);/gi,
    (m) => entities[m.toLowerCase()] ?? m
  );
  value = value
    .replace(/\s*;\s*;+/g, ";")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/^[\s;,.]+|[\s;,.]+$/g, "")
    .trim();

  return value || undefined;
}

/**
 * Read `|Field=...` from IMSLP #fte wikitext. Values may contain `|` inside
 * `{{templates}}`, so we stop at the next newline+|Field boundary — not at
 * the first pipe.
 */
export function extractImslpField(
  wikitext: string,
  field: string
): string | undefined {
  const startRe = new RegExp(`\\|${field}=`, "i");
  const match = startRe.exec(wikitext);
  if (!match || match.index == null) return undefined;

  const valueStart = match.index + match[0].length;
  const rest = wikitext.slice(valueStart);
  // Next template field: newline then |Name= or | *****SECTION*****
  const next = rest.search(/\n\|/);
  const raw = (next >= 0 ? rest.slice(0, next) : rest).trim();
  return cleanImslpFieldValue(raw);
}

async function enrichImslpPage(
  title: string
): Promise<{ instrument?: string; style?: string; key?: string; librettist?: string }> {
  const url =
    "https://imslp.org/api.php?" +
    new URLSearchParams({
      action: "parse",
      page: title,
      prop: "wikitext",
      format: "json",
    }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "CogNote/1.0 (https://cognote.studio; sheet music discovery)",
    },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    parse?: { wikitext?: { "*"?: string } };
  };
  const wt = data.parse?.wikitext?.["*"] ?? "";
  if (!wt) return {};
  return {
    instrument: extractImslpField(wt, "Instrumentation"),
    style: extractImslpField(wt, "Piece Style"),
    key: extractImslpField(wt, "Key"),
    librettist: extractImslpField(wt, "Librettist"),
  };
}

export async function searchImslp(
  query: string,
  filters?: MusicSearchFilters
): Promise<SheetMusicSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (filters?.sources?.length && !filters.sources.includes("imslp")) return [];
  // IMSLP is never one-click importable
  if (filters?.importableOnly) return [];

  const url =
    "https://imslp.org/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: q,
      gsrnamespace: "0",
      gsrlimit: "10",
      prop: "info",
      inprop: "url",
      format: "json",
      origin: "*",
    }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "CogNote/1.0 (https://cognote.studio; sheet music discovery)",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error("IMSLP search failed:", res.status);
    return [];
  }

  const data = (await res.json()) as {
    query?: {
      pages?: Record<string, { title?: string; fullurl?: string }>;
    };
  };

  const pages = Object.values(data.query?.pages ?? {}).filter(
    (p) => p.title && p.fullurl
  );

  // Enrich a handful of top hits for instrumentation / style (best-effort).
  const enriched = await Promise.all(
    pages.slice(0, 8).map(async (p) => {
      const meta = await enrichImslpPage(p.title!).catch(
        (): {
          instrument?: string;
          style?: string;
          key?: string;
          librettist?: string;
        } => ({})
      );
      return { page: p, meta };
    })
  );

  const results: SheetMusicSearchResult[] = [];
  for (const { page: p, meta } of enriched) {
    const parsed = parseImslpTitle(p.title!);
    let source_url = p.fullurl!;
    if (source_url.startsWith("//")) source_url = `https:${source_url}`;
    const item: SheetMusicSearchResult = {
      id: `imslp:${encodeURIComponent(p.title!)}`,
      source: "imslp",
      title: parsed.title,
      composer: parsed.composer,
      format: "external",
      license_code: "unknown",
      source_url,
      file_url: null,
      import_allowed: false,
      attribution:
        "IMSLP — verify the edition's copyright status before downloading or sharing.",
      instrument: meta.instrument,
      style: meta.style,
      key: meta.key,
      librettist: meta.librettist,
      external_only: true,
    };
    if (!matchesFilters(item, filters)) continue;
    results.push(item);
  }

  // Remaining pages without enrichment (if any beyond 8)
  for (const p of pages.slice(8)) {
    const parsed = parseImslpTitle(p.title!);
    let source_url = p.fullurl!;
    if (source_url.startsWith("//")) source_url = `https:${source_url}`;
    const item: SheetMusicSearchResult = {
      id: `imslp:${encodeURIComponent(p.title!)}`,
      source: "imslp",
      title: parsed.title,
      composer: parsed.composer,
      format: "external",
      license_code: "unknown",
      source_url,
      file_url: null,
      import_allowed: false,
      attribution:
        "IMSLP — verify the edition's copyright status before downloading or sharing.",
      external_only: true,
    };
    if (!matchesFilters(item, filters)) continue;
    results.push(item);
  }

  return results;
}

/** Button / link label for opening the human source page. */
export function sourceLinkLabel(source: MusicSourceId): string {
  if (source === "openscore-lieder" || source === "openscore-quartets") {
    return "Open in MuseScore";
  }
  if (source === "imslp") return "View source";
  return "View source";
}
