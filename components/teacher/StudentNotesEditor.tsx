"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StudentNotesEditor({
  studentId,
  initialNotes,
}: {
  studentId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("students")
      .update({ teacher_notes: notes.trim() })
      .eq("id", studentId);
    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  return (
    <Card padding="sm" className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted font-medium">Teacher Notes</label>
        {dirty && (
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(true);
        }}
        placeholder="Private notes about this student..."
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-y"
      />
    </Card>
  );
}
