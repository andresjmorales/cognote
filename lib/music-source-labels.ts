import type { MusicLicenseCode } from "@/lib/sheet-music";

/**
 * Client-safe source identifiers, labels and result shapes.
 *
 * This module deliberately has no runtime imports — in particular it must not
 * pull in `@/lib/music-sources`, which bundles the multi-megabyte catalogue
 * JSON indexes. Client components import from here so that the catalogue stays
 * server-side.
 */

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

/** Button / link label for opening the human source page. */
export function sourceLinkLabel(source: MusicSourceId): string {
  if (source === "openscore-lieder" || source === "openscore-quartets") {
    return "Open in MuseScore";
  }
  if (source === "imslp") return "View source";
  return "View source";
}
