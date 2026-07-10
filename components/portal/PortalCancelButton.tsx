"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PortalCancelButton({
  token,
  lessonId,
  windowHours,
}: {
  token: string;
  lessonId: string;
  windowHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/portal/${token}/lessons/${lessonId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not cancel lesson");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-error hover:underline cursor-pointer shrink-0"
      >
        Cancel lesson
      </button>
    );
  }

  return (
    <Card padding="sm" className="mt-2 w-full basis-full">
      <p className="text-sm font-medium mb-1">Cancel this lesson?</p>
      <p className="text-xs text-muted mb-2">
        Your teacher will be notified. Cancellations within {windowHours} hour
        {windowHours === 1 ? "" : "s"} of the lesson may still be billed per
        studio policy.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for your teacher…"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-2"
      />
      {error && <p className="text-xs text-error mb-2">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "Cancelling…" : "Confirm cancel"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Keep lesson
        </Button>
      </div>
    </Card>
  );
}
