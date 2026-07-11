"use client";

import dynamic from "next/dynamic";
import type { MusicFormat } from "@/lib/supabase/types";

const PdfScoreViewer = dynamic(
  () =>
    import("@/components/music/PdfScoreViewer").then((m) => m.PdfScoreViewer),
  { ssr: false, loading: () => <p className="text-sm text-muted">Loading viewer…</p> }
);

const OsmdScoreViewer = dynamic(
  () =>
    import("@/components/music/OsmdScoreViewer").then((m) => m.OsmdScoreViewer),
  { ssr: false, loading: () => <p className="text-sm text-muted">Loading viewer…</p> }
);

export function ScoreViewer({
  format,
  fileUrl,
}: {
  format: MusicFormat;
  fileUrl: string;
}) {
  if (format === "pdf") {
    return <PdfScoreViewer fileUrl={fileUrl} />;
  }
  return <OsmdScoreViewer fileUrl={fileUrl} />;
}
