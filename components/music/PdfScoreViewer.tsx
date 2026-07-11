"use client";

/**
 * Displays a score PDF via the browser's built-in PDF engine (iframe).
 *
 * We intentionally avoid PDF.js canvas rendering here: Mutopia/LilyPond and
 * many engraved scores use Type3 music fonts for noteheads/clefs, and PDF.js
 * routinely draws those glyphs as empty "tofu" boxes while Chrome/Edge/Firefox
 * native viewers render them correctly. The file URL must be an auth-checked
 * same-origin route (teacher cookie or portal token) — never a public bucket.
 */
export function PdfScoreViewer({ fileUrl }: { fileUrl: string }) {
  return (
    <div className="space-y-2">
      <iframe
        src={fileUrl}
        title="Sheet music PDF"
        className="w-full min-h-[75vh] rounded-lg border border-border bg-white"
      />
      <p className="text-xs text-muted">
        If the preview is blank, use Download — some browsers block in-page PDF
        display.
      </p>
    </div>
  );
}
