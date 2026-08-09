"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

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
  const { showToast } = useToast();
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
        showToast(err?.error ?? "Failed to unassign lesson", "error");
        setBusy(false);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      showToast("Failed to unassign lesson", "error");
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
              Remove &quot;{lessonName}&quot; from active assignments.
              {sessionCount > 0
                ? ` Practice history (${sessionCount} session${sessionCount === 1 ? "" : "s"}) is kept and moves to Past Lessons.`
                : " Practice history is kept and moves to Past Lessons."}
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
