"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface MusicItem {
  id: string;
  title: string;
  composer?: string;
  assigned?: boolean;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

/** List under a left-cluster header button (student page) — open rightward. */
const listPanelClass =
  "absolute left-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-30 w-64 max-w-[calc(100vw-1.5rem)] max-h-64 overflow-y-auto";

const formPanelClass =
  "fixed z-50 left-4 right-4 top-[12%] max-h-[80vh] overflow-y-auto sm:absolute sm:inset-auto sm:left-0 sm:right-auto sm:top-full sm:mt-1 sm:w-72 sm:max-w-[calc(100vw-1.5rem)] sm:max-h-none bg-surface border border-border rounded-lg shadow-lg p-3 space-y-3";

export function AssignSheetMusicToStudentButton({
  studentId,
  studentName,
  items,
}: {
  studentId: string;
  studentName: string;
  items: MusicItem[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MusicItem | null>(null);
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notifyFamily, setNotifyFamily] = useState(true);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function confirmAssign() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/music/${selected.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          notifyFamily,
          assignmentNote: note,
          dueDate: dueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Failed to assign", "error");
      } else if (data.alreadyAssigned) {
        showToast(`"${selected.title}" is already assigned.`, "info");
      } else if (data.emailed) {
        showToast(`"${selected.title}" assigned! Emailed the family.`);
      } else {
        showToast(
          notifyFamily
            ? `"${selected.title}" assigned. No family email on file (or email not configured).`
            : `"${selected.title}" assigned to ${studentName}.`
        );
      }
      router.refresh();
    } catch {
      showToast("Failed to assign", "error");
    }
    setBusy(false);
    close();
    setNote("");
    setDueDate("");
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
        Assign Sheet Music
      </Button>

      {open && selected && (
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={close}
        />
      )}

      {open && !selected && (
        <div className={listPanelClass}>
          {items.length === 0 ? (
            <div className="p-3 text-sm text-muted">No scores in your library yet</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  item.assigned
                    ? "text-muted bg-surface-dim/50 cursor-not-allowed"
                    : "hover:bg-surface-dim cursor-pointer"
                }`}
                disabled={busy || item.assigned}
                onClick={() => setSelected(item)}
                title={item.assigned ? "Already assigned" : undefined}
              >
                <span className="font-medium">{item.title}</span>
                {item.composer && (
                  <span className="block text-xs text-muted">{item.composer}</span>
                )}
                {item.assigned && (
                  <span className="block text-xs text-muted">Already assigned</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {open && selected && (
        <div className={formPanelClass}>
          <div className="text-sm font-medium">
            Assign &quot;{selected.title}&quot; to {studentName}
          </div>
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
    </div>
  );
}
