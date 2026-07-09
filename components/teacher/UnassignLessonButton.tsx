"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UnassignLessonButton({
  studentPlanId,
  lessonName,
  sessionCount = 0,
}: {
  studentPlanId: string;
  lessonName: string;
  sessionCount?: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleUnassign() {
    setBusy(true);
    try {
      const res = await fetch(`/api/student-plans/${studentPlanId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to unassign lesson");
        setBusy(false);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      alert("Failed to unassign lesson");
    }
    setBusy(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-error hover:bg-error/10 hover:text-error"
        onClick={() => setConfirmOpen(true)}
      >
        Unassign
      </Button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setConfirmOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Unassign lesson?</h3>
            <p className="text-muted text-sm mb-4">
              Remove &quot;{lessonName}&quot; from active assignments. Practice
              history is kept — it moves to Past Lessons.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleUnassign}
                disabled={busy}
              >
                {busy ? "Unassigning…" : "Unassign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
