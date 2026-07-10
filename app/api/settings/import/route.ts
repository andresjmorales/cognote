import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importStudioExport, parseExportPayload } from "@/lib/data-transfer";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = parseExportPayload(raw);
  if (!payload) {
    return NextResponse.json(
      { error: "Unrecognized export file (wrong version or missing tables)" },
      { status: 400 }
    );
  }

  const result = await importStudioExport(supabase, user.id, payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    counts: result.counts,
    message: "Import complete. Matching IDs were updated; new IDs were inserted.",
  });
}
