"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const fieldClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function MusicLibraryFilters({
  allTags,
}: {
  allTags: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/music?${params.toString()}`);
    });
  }

  return (
    <div className={`flex flex-wrap gap-2 items-end ${pending ? "opacity-70" : ""}`}>
      <div>
        <label className="block text-xs text-muted mb-1">Search</label>
        <input
          className={`${fieldClass} w-48`}
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Title, composer, tag…"
          onChange={(e) => {
            const value = e.target.value;
            window.clearTimeout((window as unknown as { __musicQ?: number }).__musicQ);
            (window as unknown as { __musicQ?: number }).__musicQ = window.setTimeout(
              () => update("q", value.trim()),
              300
            );
          }}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Format</label>
        <select
          className={fieldClass}
          value={searchParams.get("format") ?? ""}
          onChange={(e) => update("format", e.target.value)}
        >
          <option value="">All</option>
          <option value="pdf">PDF</option>
          <option value="musicxml">MusicXML</option>
          <option value="mxl">MXL</option>
        </select>
      </div>
      {allTags.length > 0 && (
        <div>
          <label className="block text-xs text-muted mb-1">Tag</label>
          <select
            className={fieldClass}
            value={searchParams.get("tag") ?? ""}
            onChange={(e) => update("tag", e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
