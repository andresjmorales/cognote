"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeletePlanButton({
  planId,
  planName,
}: {
  planId: string;
  planName: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/lessons/${planId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to delete lesson");
        setDeleting(false);
        return;
      }
      router.push("/lessons");
      router.refresh();
    } catch {
      alert("Failed to delete lesson");
      setDeleting(false);
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
        Delete
      </Button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setConfirmOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Delete lesson?</h3>
            <p className="text-muted text-sm mb-4">
              &quot;{planName}&quot; will be permanently deleted. Assigned students will lose this lesson. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
