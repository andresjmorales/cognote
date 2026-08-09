"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function UnassignSheetMusicButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { showToast } = useToast();

  async function handleUnassign() {
    const ok = await confirm({
      title: "Remove assignment?",
      message: "The family will no longer see this score.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/music/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    } else {
      showToast("Failed to remove assignment", "error");
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" onClick={handleUnassign}>
      Unassign
    </Button>
  );
}
