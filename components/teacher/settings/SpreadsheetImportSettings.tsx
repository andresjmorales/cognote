"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
  type NormalizedImportRow,
} from "@/lib/spreadsheet-import";

const FIELD_LABELS: Record<ImportField, string> = {
  student_name: "Student name",
  student_birthdate: "Birthdate",
  level: "Level",
  teacher_notes: "Teacher notes",
  guardian_name: "Guardian name",
  family_name: "Family name",
  email: "Email",
  phone: "Phone",
  secondary_name: "Second guardian",
  secondary_email: "Second email",
  secondary_phone: "Second phone",
};

const selectClass =
  "px-2 py-1.5 rounded-lg border border-border bg-background text-sm w-full";

export function SpreadsheetImportSettings({
  aiConfigured,
}: {
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [previewRows, setPreviewRows] = useState<NormalizedImportRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [issues, setIssues] = useState<{ row: number; message: string }[]>([]);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/spreadsheet/parse", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      setFilename(data.filename);
      setHeaders(data.headers ?? []);
      setRows(data.rows ?? []);
      setMapping(data.mapping ?? {});
      setPreviewRows(data.previewRows ?? []);
      setPreviewTotal(data.previewTotal ?? 0);
      setIssues(data.issues ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
      clearPreview();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearPreview() {
    setFilename(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreviewRows([]);
    setPreviewTotal(0);
    setIssues([]);
  }

  async function refreshPreview(nextMapping: ColumnMapping) {
    setMapping(nextMapping);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/spreadsheet/parse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping: nextMapping }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreviewRows(data.previewRows ?? []);
      setPreviewTotal(data.previewTotal ?? 0);
      setIssues(data.issues ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function suggestWithAi() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/spreadsheet/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers,
          sampleRows: rows.slice(0, 5),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Suggest failed");
      await refreshPreview({ ...mapping, ...data.mapping });
      if (data.warning) setMessage(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggest failed");
      setBusy(false);
    }
  }

  async function commit() {
    const ok = window.confirm(
      `Import ${previewTotal} student${previewTotal === 1 ? "" : "s"}? Existing students with the same name are skipped.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/import/spreadsheet/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setMessage(
        `Created ${data.studentsCreated} student${data.studentsCreated === 1 ? "" : "s"}, ${data.familiesCreated} famil${data.familiesCreated === 1 ? "y" : "ies"}. Skipped ${data.studentsSkipped}.`
      );
      clearPreview();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const header = [
      "Student Name",
      "Parent Name",
      "Email",
      "Phone",
      "Birthdate",
      "Level",
    ].join(",");
    const sample = [
      "Alex Rivera,Jordan Rivera,jordan@example.com,555-0100,2015-04-12,Faber 2A",
      "Sam Rivera,Jordan Rivera,jordan@example.com,555-0100,,",
    ].join("\n");
    const blob = new Blob([`${header}\n${sample}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cognote-students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <h2 className="font-semibold text-lg mb-1">Import students</h2>
      <p className="text-sm text-muted mb-4">
        Upload a CSV or Excel sheet (first sheet only). Map columns, preview,
        then import. Works without AI; optional AI can suggest mappings if you
        configured a key under Optional AI.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy && !filename ? "Reading…" : "Upload spreadsheet…"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={downloadTemplate}
        >
          Download CSV template
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {filename && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm">
            <span className="font-medium">{filename}</span>
            <span className="text-muted">
              {" "}
              · {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
              {previewTotal} ready
            </span>
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <label key={field} className="text-xs space-y-1">
                <span className="text-muted font-medium">
                  {FIELD_LABELS[field]}
                  {field === "student_name" ? " *" : ""}
                </span>
                <select
                  className={selectClass}
                  value={mapping[field] ?? ""}
                  onChange={(e) => {
                    const next = {
                      ...mapping,
                      [field]: e.target.value || null,
                    };
                    void refreshPreview(next);
                  }}
                >
                  <option value="">(not mapped)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {aiConfigured && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void suggestWithAi()}
              >
                Suggest mapping with AI
              </Button>
            )}
            <Button
              size="sm"
              disabled={busy || previewTotal === 0}
              onClick={() => void commit()}
            >
              {busy ? "Working…" : `Import ${previewTotal} students`}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={clearPreview}
            >
              Cancel
            </Button>
          </div>

          {previewRows.length > 0 && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="py-1 pr-2">Row</th>
                    <th className="py-1 pr-2">Student</th>
                    <th className="py-1 pr-2">Guardian</th>
                    <th className="py-1 pr-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 12).map((r) => (
                    <tr key={r.sourceRow} className="border-b border-border/60">
                      <td className="py-1 pr-2">{r.sourceRow}</td>
                      <td className="py-1 pr-2">{r.studentName}</td>
                      <td className="py-1 pr-2">
                        {r.guardianName || r.familyName || "—"}
                      </td>
                      <td className="py-1 pr-2">{r.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewTotal > 12 && (
                <p className="text-muted mt-1">
                  Showing 12 of {previewTotal}…
                </p>
              )}
            </div>
          )}

          {issues.length > 0 && (
            <ul className="text-xs text-muted list-disc list-inside">
              {issues.slice(0, 8).map((i) => (
                <li key={`${i.row}-${i.message}`}>
                  Row {i.row}: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && <p className="text-sm text-success mt-3">{message}</p>}
      {error && <p className="text-sm text-error mt-3">{error}</p>}
    </Card>
  );
}
