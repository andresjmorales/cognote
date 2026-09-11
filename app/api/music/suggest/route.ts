import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMetadataSuggestions } from "@/lib/music-metadata-suggest";
import type { SuggestField } from "@/lib/music-metadata";

/**
 * Autofill candidates for the upload form's metadata fields. Served from the
 * bundled catalogue indexes only (no upstream call), so it can answer while
 * the teacher types.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const fieldParam = req.nextUrl.searchParams.get("field");
  const field: SuggestField = fieldParam === "composer" ? "composer" : "title";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json({
    suggestions: buildMetadataSuggestions(field, q),
  });
}
