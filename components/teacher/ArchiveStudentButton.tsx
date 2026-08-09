"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ArchiveStudentButton({
  studentId,
  studentName,
  archived,
}: {
  studentId: string;
  studentName: string;
  archived: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast(err?.error ?? "Failed to update student", "error");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      showToast("Failed to update student", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={toggle}
      title={
        archived
          ? `Restore ${studentName} to active`
          : `Archive ${studentName} (won't count toward free-plan limits)`
      }
    >
      {busy ? "…" : archived ? "Restore" : "Archive"}
    </Button>
  );
}
