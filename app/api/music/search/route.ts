import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ALL_SOURCES,
  searchImslp,
  searchStaticIndexes,
  type MusicSearchFilters,
  type MusicSourceId,
  type SheetMusicSearchResult,
} from "@/lib/music-sources";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      results: [],
      error: "Enter at least 2 characters",
    });
  }

  const sourcesParam = req.nextUrl.searchParams.get("sources");
  const sources = sourcesParam
    ? (sourcesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is MusicSourceId =>
          (ALL_SOURCES as string[]).includes(s)
        ) as MusicSourceId[])
    : ALL_SOURCES;

  const filters: MusicSearchFilters = {
    sources,
    importableOnly: req.nextUrl.searchParams.get("importable") === "1",
    instrument: req.nextUrl.searchParams.get("instrument")?.trim() || undefined,
    style: req.nextUrl.searchParams.get("style")?.trim() || undefined,
  };

  const staticSources = sources.filter((s) => s !== "imslp");
  const results: SheetMusicSearchResult[] = [
    ...searchStaticIndexes(q, { ...filters, sources: staticSources }),
  ];

  if (sources.includes("imslp")) {
    try {
      results.push(...(await searchImslp(q, filters)));
    } catch (err) {
      console.error("IMSLP search error:", err);
    }
  }

  const rank = (r: SheetMusicSearchResult) => {
    if (r.import_allowed) return 0;
    if (r.source !== "imslp") return 1;
    return 2;
  };
  results.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.title.localeCompare(b.title) ||
      a.composer.localeCompare(b.composer)
  );

  return NextResponse.json({
    results: results.slice(0, 40),
    query: q,
  });
}
