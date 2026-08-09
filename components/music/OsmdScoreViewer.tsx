"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders MusicXML / MXL with OpenSheetMusicDisplay. Loads from an
 * auth-checked file route only.
 */
export function OsmdScoreViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let osmd: { clear?: () => void } | null = null;

    async function render() {
      setLoading(true);
      setError(null);
      try {
        const [{ OpenSheetMusicDisplay }, res] = await Promise.all([
          import("opensheetmusicdisplay"),
          fetch(fileUrl),
        ]);
        if (!res.ok) throw new Error("Could not load score");
        const buffer = await res.arrayBuffer();
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const display = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          backend: "svg",
        });
        osmd = display;
        await display.load(new Blob([buffer]));
        if (cancelled) return;
        display.render();
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not display this MusicXML score.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const container = containerRef.current;
    render();
    return () => {
      cancelled = true;
      try {
        osmd?.clear?.();
      } catch {
        /* ignore */
      }
      if (container) container.innerHTML = "";
    };
  }, [fileUrl]);

  return (
    <div>
      {loading && <p className="text-sm text-muted mb-2">Loading score…</p>}
      {error && <p className="text-sm text-error mb-2">{error}</p>}
      <div
        ref={containerRef}
        className="overflow-x-auto bg-white rounded-lg p-2 min-h-[120px]"
      />
    </div>
  );
}
