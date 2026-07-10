"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DataTransferSettings() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "cognote-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }
      const total = Object.values(data.counts as Record<string, number>).reduce(
        (a, b) => a + b,
        0
      );
      setMessage(`Import complete (${total} rows upserted).`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-lg mb-1">Export &amp; Import</h2>
      <p className="text-sm text-muted mb-4">
        Download a full JSON backup of your studio data (students, families,
        schedule, lesson notes, practice history, skills, invoices, and
        settings — including payment keys). Import restores into this account
        by upserting matching IDs.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={exporting || importing}
          onClick={handleExport}
        >
          {exporting ? "Exporting…" : "Export all data"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={exporting || importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? "Importing…" : "Import from file…"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = window.confirm(
              "Import will upsert rows from this file into your studio (same IDs overwrite). Continue?"
            );
            if (ok) void handleImportFile(file);
            else if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </div>

      {message && <p className="text-sm text-success mt-3">{message}</p>}
      {error && <p className="text-sm text-error mt-3">{error}</p>}
    </Card>
  );
}
