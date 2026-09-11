import {
  SOURCE_LABELS,
  indexedComposers,
  searchStaticIndexes,
  type MusicSourceId,
  type SheetMusicSearchResult,
} from "@/lib/music-sources";
import {
  normalizeComposer,
  suggestionTags,
  type MetadataSuggestion,
  type SuggestField,
} from "@/lib/music-metadata";

/**
 * Catalogue-backed autofill for the upload form. Server-only: it reads the
 * bundled static indexes, so keep it out of client components.
 */

const MAX_SUGGESTIONS = 6;

function toWorkSuggestion(row: SheetMusicSearchResult): MetadataSuggestion {
  const composer = normalizeComposer(row.composer);
  return {
    id: row.id,
    label: row.title,
    detail: composer,
    sourceLabel: SOURCE_LABELS[row.source as MusicSourceId] ?? row.source,
    title: row.title,
    composer,
    arranger: (row.arranger ?? "").trim(),
    tags: suggestionTags(row),
  };
}

/** Collapse the same work appearing in several catalogues / editions. */
export function dedupeWorkSuggestions(
  rows: SheetMusicSearchResult[],
  limit = MAX_SUGGESTIONS
): MetadataSuggestion[] {
  const out: MetadataSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const suggestion = toWorkSuggestion(row);
    const key = `${suggestion.title} ${suggestion.composer}`
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Composer-field suggestions: one row per distinct person, so applying one
 * never rewrites the title with an unrelated piece.
 */
export function composerSuggestionsFrom(
  composers: string[],
  query: string,
  limit = MAX_SUGGESTIONS
): MetadataSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: { score: number; name: string }[] = [];
  const seen = new Set<string>();
  for (const raw of composers) {
    const name = normalizeComposer(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    // Match against both spellings so "bach, j" and "j. s. bach" both land.
    const hay = `${key} ${raw.toLowerCase()}`;
    if (!hay.includes(q)) continue;
    seen.add(key);
    // Prefix hits first, then word-start hits, then anything else.
    const score = key.startsWith(q) ? 0 : hay.includes(` ${q}`) ? 1 : 2;
    scored.push({ score, name });
  }

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((entry) => ({
    id: `composer:${entry.name}`,
    label: entry.name,
    detail: "",
    sourceLabel: "Catalogue",
    title: "",
    composer: entry.name,
    arranger: "",
    tags: [],
  }));
}

/**
 * Autofill candidates for one upload field. Backed entirely by the bundled
 * static indexes — no upstream call, so it is safe to hit per keystroke.
 */
export function buildMetadataSuggestions(
  field: SuggestField,
  query: string,
  limit = MAX_SUGGESTIONS
): MetadataSuggestion[] {
  const q = query.trim();
  if (q.length < 2) return [];
  if (field === "composer") {
    return composerSuggestionsFrom(indexedComposers(), q, limit);
  }
  // Discovery search also matches instrumentation and period, which is noise
  // when the teacher is naming a piece ("fren" would pull in every French
  // horn part), so keep only rows that match on the work itself.
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = searchStaticIndexes(q).filter((row) => {
    const hay =
      `${row.title} ${row.composer} ${row.arranger ?? ""}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
  return dedupeWorkSuggestions(rows, limit);
}
