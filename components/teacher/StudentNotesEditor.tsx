"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

export function StudentNotesEditor({
  studentId,
  initialNotes,
}: {
  studentId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("students")
        .update({ teacher_notes: notes })
        .eq("id", studentId);
      if (error) {
        showToast("Failed to save notes. Please try again.", "error");
        return;
      }
      setDirty(false);
      router.refresh();
    } catch {
      showToast("Failed to save notes. Check your connection.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="sm" className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="text-xs text-muted font-medium">
            Private Notes about Student
          </label>
          <p className="text-[11px] text-muted mt-0.5">
            You can keep track of specific assignments and things learned. Parents won&apos;t see this.
          </p>
        </div>
        {dirty && (
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
      <RichTextEditor
        value={notes}
        onChange={(html) => {
          setNotes(html);
          setDirty(true);
        }}
        placeholder="Private notes about this student…"
        minHeightClass="min-h-[160px]"
      />
    </Card>
  );
}
