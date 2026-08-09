const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&amp;": "&",
};

/**
 * Decode exactly one level of common HTML entities. A single-pass regex with
 * a lookup map cannot re-decode its own output (unlike chained replaces),
 * so "&amp;lt;" decodes to "&lt;" and stops there.
 */
function decodeBasicHtmlEntities(text: string): string {
  return text.replace(
    /&(?:nbsp|lt|gt|quot|amp|#39);/gi,
    (match) => ENTITY_MAP[match.toLowerCase()] ?? match
  );
}

/** Best-effort HTML → plain text for AI prompts and previews. */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  // Strip complete tags, then any leftover `<` from broken/nested markup
  // (e.g. <scr<script>ipt>) so the result cannot retain HTML openers.
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/</g, "");

  return decodeBasicHtmlEntities(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Escape plain text for safe insertion into an HTML notes field. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  return html;
}

/**
 * Convert a limited markdown subset to TipTap/StarterKit-friendly HTML.
 * Supports: paragraphs, ##/### headings (→ h3), bullet/ordered lists,
 * bold, italic. TipTap does not ingest raw markdown; it expects HTML.
 */
export function markdownToTiptapHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push(`<h3>${applyInlineMarkdown(heading[2])}</h3>`);
      i++;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^[-*+]\s+/, "");
        items.push(`<li><p>${applyInlineMarkdown(item)}</p></li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(`<li><p>${applyInlineMarkdown(item)}</p></li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paraLines: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      `<p>${applyInlineMarkdown(paraLines.join(" ")).replace(/\n/g, "<br>")}</p>`
    );
  }

  return blocks.join("");
}

/** @deprecated Prefer markdownToTiptapHtml for AI drafts. */
export function plainTextToHtmlParagraphs(text: string): string {
  return markdownToTiptapHtml(text);
}
