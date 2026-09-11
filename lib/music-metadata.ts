/**
 * Shapes and pure helpers shared by the upload form and the suggestion
 * endpoint. Deliberately free of catalogue imports: the form is a client
 * component, and the bundled indexes are megabytes of server-only JSON.
 */

/** Which upload field the user is typing in. */
export type SuggestField = "title" | "composer";

/**
 * One autofill candidate. `title`/`composer`/`arranger`/`tags` are the values
 * written into the form when the row is previewed or applied; an empty value
 * means "leave whatever the teacher already typed".
 */
export interface MetadataSuggestion {
  id: string;
  /** Text rendered as the option's primary line. */
  label: string;
  /** Secondary line (composer for a work, a plain hint for a composer). */
  detail: string;
  sourceLabel: string;
  title: string;
  composer: string;
  arranger: string;
  tags: string[];
}

/** The four metadata fields autofill can write. */
export interface UploadMetadata {
  title: string;
  composer: string;
  arranger: string;
  /** Comma-separated, as typed in the tags field. */
  tags: string;
}

/**
 * Catalogue composers carry life dates and are often filed surname-first
 * ("Bach, Johann Sebastian (1685–1750)"). Teachers write them the way they
 * read on a program.
 */
export function normalizeComposer(raw: string): string {
  let value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";

  // Trailing life dates: "(1685–1750)", "(b. 1932)", "(fl. 1600)".
  value = value.replace(/\s*\((?=[^)]*\d)[^)]*\)\s*$/, "").trim();

  // "Surname, Forenames" → "Forenames Surname". Only for a single comma, and
  // never for generational suffixes ("Bach, Jr." keeps its shape).
  const parts = value.split(",");
  if (parts.length === 2) {
    const [last, first] = parts.map((p) => p.trim());
    const isSuffix = /^(jr\.?|sr\.?|i{1,3}|iv|v)$/i.test(first);
    if (last && first && !isSuffix) {
      value = `${first} ${last}`;
    }
  }

  return value.replace(/\s+/g, " ").trim();
}

/**
 * Tag line seeded from catalogue instrumentation and period, in the same
 * comma-separated shape `parseTags` expects on submit.
 */
export function suggestionTags(row: {
  instrument?: string;
  style?: string;
}): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const field of [row.instrument, row.style]) {
    for (const part of (field ?? "").split(/[,;]/)) {
      const tag = part.trim().toLowerCase();
      if (!tag || tag.length > 40 || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= 6) return tags;
    }
  }
  return tags;
}

/**
 * Best-effort work title from an uploaded filename, used to seed suggestions
 * before the teacher has typed anything ("bwv814_french-suite-3.pdf" →
 * "bwv814 french suite 3").
 */
export function filenameToQuery(filename: string): string {
  return (filename.split(/[/\\]/).pop() ?? "")
    .replace(/\.[^.]+$/, "")
    // Leading track numbers ("01 - ", "03. "). The trailing space keeps
    // genuine titles like "3-part invention" intact.
    .replace(/^\s*\d{1,3}\s*[-.)]\s+/, "")
    // Browser copy markers ("score (1).pdf").
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge a suggestion over what the teacher already typed. A field the
 * suggestion has nothing for keeps its current value, so the hover preview and
 * the committed result are always the same edit.
 */
export function applySuggestion(
  current: UploadMetadata,
  suggestion: MetadataSuggestion | null
): UploadMetadata {
  if (!suggestion) return current;
  return {
    title: suggestion.title || current.title,
    composer: suggestion.composer || current.composer,
    arranger: suggestion.arranger || current.arranger,
    tags: suggestion.tags.length ? suggestion.tags.join(", ") : current.tags,
  };
}
