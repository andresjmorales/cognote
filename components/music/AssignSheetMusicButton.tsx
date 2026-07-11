"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  name: string;
  assigned?: boolean;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function AssignSheetMusicButton({
  musicItemId,
  students,
}: {
  musicItemId: string;
  students: Student[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notifyFamily, setNotifyFamily] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function confirmAssign() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/music/${musicItemId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selected.id,
          notifyFamily,
          assignmentNote: note,
          dueDate: dueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error ?? "Failed to assign");
      } else if (data.alreadyAssigned) {
        setToast(`${selected.name} already has this score.`);
      } else if (data.emailed) {
        setToast(`Assigned to ${selected.name}! Emailed the family.`);
      } else {
        setToast(
          notifyFamily
            ? `Assigned to ${selected.name}. No family email on file (or email not configured).`
            : `Assigned to ${selected.name}.`
        );
      }
      setTimeout(() => setToast(null), 5000);
      router.refresh();
    } catch {
      setToast("Failed to assign");
      setTimeout(() => setToast(null), 4000);
    }
    setBusy(false);
    setOpen(false);
    setSelected(null);
    setNote("");
    setDueDate("");
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button size="sm" onClick={() => setOpen(!open)}>
        Assign
      </Button>

      {open && !selected && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 w-52">
          {students.length === 0 ? (
            <div className="p-3 text-sm text-muted">No students yet</div>
          ) : (
            students.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  s.assigned
                    ? "text-muted bg-surface-dim/50 cursor-not-allowed"
                    : "hover:bg-surface-dim cursor-pointer"
                }`}
                disabled={busy || s.assigned}
                onClick={() => setSelected(s)}
                title={s.assigned ? "Already assigned" : undefined}
              >
                {s.name}
                {s.assigned && (
                  <span className="block text-xs text-muted">Already assigned</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {open && selected && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 w-72 p-3 space-y-3">
          <div className="text-sm font-medium">Assign to {selected.name}</div>
          <div>
            <label className="block text-xs text-muted mb-1">Practice note</label>
            <textarea
              className={fieldClass}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for the family"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Due date</label>
            <input
              type="date"
              className={fieldClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={notifyFamily}
              onChange={(e) => setNotifyFamily(e.target.checked)}
            />
            Email family now
          </label>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="button" size="sm" onClick={confirmAssign} disabled={busy}>
              {busy ? "Assigning…" : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
