import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  familyGroupKey,
  normalizeImportRows,
  type ColumnMapping,
  type NormalizedImportRow,
} from "@/lib/spreadsheet-import";
import { insertGuardian } from "@/lib/server/families";

export async function POST(req: NextRequest) {
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

  if (body.rows.length > 500) {
    return NextResponse.json(
      { error: "Import is limited to 500 rows at a time" },
      { status: 400 }
    );
  }

  const { rows, issues } = normalizeImportRows(body.rows, body.mapping);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid student rows to import", issues },
      { status: 400 }
    );
  }

  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, name")
    .eq("teacher_id", user.id);

  const existingNames = new Set(
    (existingStudents ?? []).map((s) => s.name.trim().toLowerCase())
  );

  const { data: existingGuardians } = await supabase
    .from("guardians")
    .select("id, email, name")
    .eq("teacher_id", user.id);

  const guardianByEmail = new Map<string, string>();
  for (const g of existingGuardians ?? []) {
    if (g.email?.trim()) {
      guardianByEmail.set(g.email.trim().toLowerCase(), g.id);
    }
  }

  const groups = new Map<string, NormalizedImportRow[]>();
  for (const row of rows) {
    const key = familyGroupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let studentsCreated = 0;
  let studentsSkipped = 0;
  let familiesCreated = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (const [, group] of groups) {
    const head = group[0];
    let guardianId: string | null = null;

    const email = head.email?.trim().toLowerCase() || null;
    if (email && guardianByEmail.has(email)) {
      guardianId = guardianByEmail.get(email)!;
    } else {
      const hasContact =
        Boolean(email) ||
        Boolean(head.phone) ||
        Boolean(head.guardianName) ||
        Boolean(head.familyName);

      if (hasContact || group.length >= 1) {
        const guardianName =
          head.guardianName?.trim() ||
          head.familyName?.trim() ||
          (email || head.phone
            ? `Parent of ${head.studentName}`
            : head.studentName);

        const { data: guardian, error } = await insertGuardian(
          supabase,
          user.id,
          {
            name: guardianName,
            familyName: head.familyName,
            email: head.email,
            phone: head.phone,
            secondaryName: head.secondaryName,
            secondaryEmail: head.secondaryEmail,
            secondaryPhone: head.secondaryPhone,
          }
        );

        if (error || !guardian) {
          for (const r of group) {
            skipped.push({
              row: r.sourceRow,
              reason: error?.message ?? "Failed to create family",
            });
            studentsSkipped += 1;
          }
          continue;
        }

        guardianId = guardian.id;
        familiesCreated += 1;
        if (email) guardianByEmail.set(email, guardian.id);
      }
    }

    for (const r of group) {
      const key = r.studentName.trim().toLowerCase();
      if (existingNames.has(key)) {
        studentsSkipped += 1;
        skipped.push({
          row: r.sourceRow,
          reason: `Student "${r.studentName}" already exists`,
        });
        continue;
      }

      const { error } = await supabase.from("students").insert({
        teacher_id: user.id,
        name: r.studentName.trim(),
        guardian_id: guardianId,
        birthdate: r.birthdate,
        level: r.level,
        teacher_notes: r.teacherNotes ?? "",
      });

      if (error) {
        studentsSkipped += 1;
        skipped.push({ row: r.sourceRow, reason: error.message });
        continue;
      }

      existingNames.add(key);
      studentsCreated += 1;
    }
  }

  return NextResponse.json({
    studentsCreated,
    studentsSkipped,
    familiesCreated,
    issues,
    skipped: skipped.slice(0, 50),
  });
}
