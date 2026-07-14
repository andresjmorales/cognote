"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
        alert(err?.error ?? "Failed to update student");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to update student");
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
