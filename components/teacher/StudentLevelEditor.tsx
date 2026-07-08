"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline editor for the student's optional level anchor (RCM level,
 * Faber book, ...) — free text because leveling systems vary.
 */
export function StudentLevelEditor({
  studentId,
  initialLevel,
}: {
  studentId: string;
  initialLevel: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialLevel ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: value }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="e.g. RCM Level 3, Faber 2B"
          className="px-2 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm w-44"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-primary hover:text-primary-dark font-semibold cursor-pointer"
        >
          {saving ? "..." : "Save"}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-muted text-sm hover:text-primary transition-colors cursor-pointer"
      title="Set the student's level (RCM, Faber, ...)"
    >
      {initialLevel ? (
        <>Level: <span className="font-medium">{initialLevel}</span></>
      ) : (
        "Set level"
      )}
    </button>
  );
}
