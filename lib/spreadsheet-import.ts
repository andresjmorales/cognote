import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Spreadsheet → students/families import (non-AI path).
 * Heuristic column mapping + row normalization. AI assist is optional.
 */

export const IMPORT_FIELDS = [
  "student_name",
  "student_birthdate",
  "level",
  "teacher_notes",
  "guardian_name",
  "family_name",
  "email",
  "phone",
  "secondary_name",
  "secondary_email",
  "secondary_phone",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ColumnMapping = Partial<Record<ImportField, string | null>>;

export interface NormalizedImportRow {
  studentName: string;
  birthdate: string | null;
  level: string | null;
  teacherNotes: string | null;
  guardianName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  secondaryName: string | null;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  /** 1-based spreadsheet row for error messages */
  sourceRow: number;
}

export interface ImportPreviewIssue {
  row: number;
  message: string;
}

const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  student_name: [
    "student",
    "student name",
    "student_name",
    "name",
    "child",
    "child name",
    "learner",
    "pupil",
  ],
  student_birthdate: [
    "birthdate",
    "birthday",
    "dob",
    "date of birth",
    "birth date",
    "student birthdate",
  ],
  level: ["level", "rcm", "grade", "book", "method level"],
  teacher_notes: ["notes", "teacher notes", "comments", "memo"],
  guardian_name: [
    "guardian",
    "guardian name",
    "parent",
    "parent name",
    "mom",
    "dad",
    "mother",
    "father",
    "contact name",
    "primary contact",
  ],
  family_name: ["family", "family name", "household"],
  email: [
    "email",
    "e-mail",
    "parent email",
    "guardian email",
    "contact email",
    "email address",
  ],
  phone: [
    "phone",
    "mobile",
    "cell",
    "telephone",
    "parent phone",
    "guardian phone",
    "contact phone",
  ],
  secondary_name: [
    "secondary",
    "secondary name",
    "second guardian",
    "parent 2",
    "other parent",
  ],
  secondary_email: ["secondary email", "parent 2 email", "other email"],
  secondary_phone: ["secondary phone", "parent 2 phone", "other phone"],
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Suggest a column mapping from header labels (no AI). */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();
  const mapping: ColumnMapping = {};

  for (const field of IMPORT_FIELDS) {
    const synonyms = HEADER_SYNONYMS[field];
    const hit = normalized.find(
      (h) =>
        !used.has(h.raw) &&
        synonyms.some((s) => h.norm === s || h.norm.includes(s))
    );
    if (hit) {
      // Prefer exact synonym match over includes for ambiguous "name"
      const exact = normalized.find(
        (h) =>
          !used.has(h.raw) && synonyms.some((s) => h.norm === s)
      );
      const chosen = exact ?? hit;
      // "name" alone maps to student_name only if no better student header
      if (
        field === "student_name" ||
        chosen.norm !== "name" ||
        !mapping.student_name
      ) {
        if (field === "guardian_name" && chosen.norm === "name") {
          continue;
        }
        mapping[field] = chosen.raw;
        used.add(chosen.raw);
      }
    }
  }

  // If we still lack student_name but have a lone "name" column
  if (!mapping.student_name) {
    const nameCol = normalized.find(
      (h) => !used.has(h.raw) && h.norm === "name"
    );
    if (nameCol) {
      mapping.student_name = nameCol.raw;
    }
  }

  return mapping;
}

function cell(
  row: Record<string, string>,
  header: string | null | undefined
): string {
  if (!header) return "";
  const v = row[header];
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function parseBirthdate(raw: string): string | null {
  if (!raw) return null;
  // Excel serial dates sometimes arrive as numbers-as-strings
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const mdy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (mdy) {
    const a = Number(mdy[1]);
    const b = Number(mdy[2]);
    let y = Number(mdy[3]);
    if (y < 100) y += 2000;
    // Prefer M/D/Y (US)
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function normalizeImportRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  /** Spreadsheet row index of the first data row (usually 2 if row 1 is headers). */
  firstDataRowNumber = 2
): { rows: NormalizedImportRow[]; issues: ImportPreviewIssue[] } {
  const out: NormalizedImportRow[] = [];
  const issues: ImportPreviewIssue[] = [];

  rows.forEach((row, i) => {
    const sourceRow = firstDataRowNumber + i;
    const studentName = cell(row, mapping.student_name);
    if (!studentName) {
      const anyValue = Object.values(row).some((v) => String(v ?? "").trim());
      if (anyValue) {
        issues.push({
          row: sourceRow,
          message: "Missing student name (skipped)",
        });
      }
      return;
    }

    const birthRaw = cell(row, mapping.student_birthdate);
    let birthdate: string | null = null;
    if (birthRaw) {
      birthdate = parseBirthdate(birthRaw);
      if (!birthdate) {
        issues.push({
          row: sourceRow,
          message: `Could not parse birthdate "${birthRaw}"`,
        });
      }
    }

    out.push({
      studentName,
      birthdate,
      level: cell(row, mapping.level) || null,
      teacherNotes: cell(row, mapping.teacher_notes) || null,
      guardianName: cell(row, mapping.guardian_name) || null,
      familyName: cell(row, mapping.family_name) || null,
      email: cell(row, mapping.email) || null,
      phone: cell(row, mapping.phone) || null,
      secondaryName: cell(row, mapping.secondary_name) || null,
      secondaryEmail: cell(row, mapping.secondary_email) || null,
      secondaryPhone: cell(row, mapping.secondary_phone) || null,
      sourceRow,
    });
  });

  return { rows: out, issues };
}

/** Family grouping key for commit: email → family name → guardian name → student. */
export function familyGroupKey(row: NormalizedImportRow): string {
  const email = row.email?.toLowerCase();
  if (email) return `email:${email}`;
  if (row.familyName) return `family:${row.familyName.toLowerCase()}`;
  if (row.guardianName) return `guardian:${row.guardianName.toLowerCase()}`;
  return `solo:${row.studentName.toLowerCase()}:${row.sourceRow}`;
}

export function parseDelimitedText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  const headers = result.meta.fields?.filter(Boolean) ?? [];
  const rows = (result.data ?? []).map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) {
      out[h] = r[h] == null ? "" : String(r[h]);
    }
    return out;
  });
  return { headers, rows };
}

export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer,
  filename: string
): { headers: string[]; rows: Record<string, string>[] } {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseDelimitedText(text);
  }

  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (json.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]).map((h) => String(h).trim());
  const rows = json.map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) {
      const v = r[h];
      out[h] = v == null ? "" : String(v).trim();
    }
    return out;
  });
  return { headers, rows };
}
