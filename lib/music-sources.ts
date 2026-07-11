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
  file_url?: string | null;
  import_allowed: boolean;
  attribution?: string;
  instrument?: string;
  external_only?: boolean;
}

export const SOURCE_LABELS: Record<MusicSourceId, string> = {
  "openscore-lieder": "OpenScore Lieder",
  "openscore-quartets": "OpenScore Quartets",
  mutopia: "Mutopia",
  imslp: "IMSLP",
};

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

export function searchStaticIndexes(
  query: string,
  sources?: MusicSourceId[]
): SheetMusicSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const allow = sources?.length ? new Set(sources) : null;

  const scored: { score: number; item: SheetMusicSearchResult }[] = [];

  for (const row of STATIC_INDEXES) {
    if (allow && !allow.has(row.source)) continue;
    const hay =
      `${row.title} ${row.composer} ${row.arranger ?? ""} ${row.instrument ?? ""}`.toLowerCase();
    const score = scoreMatch(hay, terms);
    if (score < 0) continue;
    scored.push({
      score,
      item: {
        id: row.id,
        source: row.source,
        title: row.title,
        composer: row.composer,
        arranger: row.arranger,
        format: row.format,
        license_code: row.license_code,
        license_url: row.license_url,
        source_url: row.source_url,
        file_url: row.file_url,
        import_allowed: row.import_allowed,
        attribution: row.attribution,
        instrument: row.instrument,
        external_only: row.external_only,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.map((s) => s.item);
}

export function findIndexedResult(id: string): SheetMusicSearchResult | null {
  const row = STATIC_INDEXES.find((r) => r.id === id);
  if (!row) return null;
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
    file_url: row.file_url,
    import_allowed: row.import_allowed,
    attribution: row.attribution,
    instrument: row.instrument,
    external_only: row.external_only,
  };
}

function parseImslpTitle(title: string): { title: string; composer: string } {
  const m = title.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (!m) return { title, composer: "" };
  return { title: m[1], composer: m[2] };
}

export async function searchImslp(query: string): Promise<SheetMusicSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    "https://imslp.org/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: q,
      gsrnamespace: "0",
      gsrlimit: "12",
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
    query?: { pages?: Record<string, { title?: string; fullurl?: string }> };
  };

  const pages = Object.values(data.query?.pages ?? {});
  return pages
    .filter((p) => p.title && p.fullurl)
    .map((p) => {
      const parsed = parseImslpTitle(p.title!);
      let source_url = p.fullurl!;
      if (source_url.startsWith("//")) source_url = `https:${source_url}`;
      return {
        id: `imslp:${encodeURIComponent(p.title!)}`,
        source: "imslp" as const,
        title: parsed.title,
        composer: parsed.composer,
        format: "external" as const,
        license_code: "unknown" as const,
        source_url,
        file_url: null,
        import_allowed: false,
        attribution:
          "IMSLP — verify the edition's copyright status before downloading or sharing.",
        external_only: true,
      };
    });
}
