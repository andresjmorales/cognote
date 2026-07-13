"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markdownToTiptapHtml } from "@/lib/rich-text";

/**
 * Optional AI progress draft. Render nothing unless Optional AI is configured —
 * AI stays invisible when unused.
 */
export function StudentAiSummaryCard({
  studentId,
  aiConfigured,
  currentNotesHtml,
}: {
  studentId: string;
  aiConfigured: boolean;
  currentNotesHtml: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!aiConfigured) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/students/${studentId}/summary/draft`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to draft summary");
      return;
    }
    setDraft(typeof data.summary === "string" ? data.summary : "");
    if (data.warning) setError(data.warning);
  }

  async function appendToNotes() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    const addition = markdownToTiptapHtml(draft.trim());
    const next =
      currentNotesHtml.trim().length > 0
        ? `${currentNotesHtml}${addition}`
        : addition;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("students")
      .update({ teacher_notes: next })
      .eq("id", studentId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDraft("");
    router.refresh();
  }

  return (
    <Card padding="sm" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-xs text-muted font-medium">
            AI progress summary
          </div>
          <p className="text-[11px] text-muted mt-0.5">
            Draft as markdown (bold, lists, headings). Converted for the notes
            editor when you add it.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}
        </Button>
      </div>

      {error && <p className="text-xs text-error mb-2">{error}</p>}

      {draft && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-mono resize-y"
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraft("")}
              disabled={saving}
            >
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={appendToNotes}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Saving…" : "Add to private notes"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
