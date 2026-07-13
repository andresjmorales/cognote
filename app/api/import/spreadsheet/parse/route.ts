import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeImportRows,
  parseSpreadsheetBuffer,
  suggestColumnMapping,
  type ColumnMapping,
} from "@/lib/spreadsheet-import";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 2 MB)" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();
  let headers: string[];
  let rows: Record<string, string>[];
  try {
    ({ headers, rows } = parseSpreadsheetBuffer(buffer, file.name));
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not parse spreadsheet",
      },
      { status: 400 }
    );
  }

  if (headers.length === 0) {
    return NextResponse.json(
      { error: "No columns found in the first sheet" },
      { status: 400 }
    );
  }

  const mapping = suggestColumnMapping(headers);
  const { rows: previewRows, issues } = normalizeImportRows(rows, mapping);

  return NextResponse.json({
    filename: file.name,
    headers,
    sampleRows: rows.slice(0, 8),
    rowCount: rows.length,
    mapping,
    previewRows: previewRows.slice(0, 50),
    previewTotal: previewRows.length,
    issues: issues.slice(0, 40),
    /** Full rows kept client-side via remapping; server stores nothing. */
    rows,
  });
}

/** Re-preview with an edited mapping (no file re-upload). */
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    rows?: Record<string, string>[];
    mapping?: ColumnMapping;
  };

  if (!Array.isArray(body.rows) || !body.mapping) {
    return NextResponse.json(
      { error: "rows and mapping are required" },
      { status: 400 }
    );
  }

  const { rows: previewRows, issues } = normalizeImportRows(
    body.rows,
    body.mapping
  );

  return NextResponse.json({
    previewRows: previewRows.slice(0, 50),
    previewTotal: previewRows.length,
    issues: issues.slice(0, 40),
  });
}
