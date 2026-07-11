"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UnassignSheetMusicButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();

  async function handleUnassign() {
    if (!confirm("Remove this assignment? The family will no longer see it.")) return;
    const res = await fetch(`/api/music/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <Button type="button" size="sm" variant="secondary" onClick={handleUnassign}>
      Unassign
    </Button>
  );
}
