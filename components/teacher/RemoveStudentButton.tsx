"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RemoveStudentButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to remove student");
        setRemoving(false);
        return;
      }
      router.push("/students");
      router.refresh();
    } catch {
      alert("Failed to remove student");
      setRemoving(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-error hover:bg-error/10 hover:text-error"
        onClick={() => setConfirmOpen(true)}
      >
        Remove student
      </Button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !removing && setConfirmOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Remove student?</h3>
            <p className="text-muted text-sm mb-4">
              &quot;{studentName}&quot; will be removed from your student list. Their lesson assignments and practice history will be deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
