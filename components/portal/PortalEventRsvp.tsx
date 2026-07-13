"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RsvpStatus } from "@/lib/supabase/types";

type RespondStatus = "yes" | "no" | "maybe";

const STATUS_LABELS: Record<RespondStatus, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

export function PortalEventRsvp({
  token,
  eventId,
  initialStatus,
  initialPartySize,
  initialNote,
}: {
  token: string;
  eventId: string;
  initialStatus: RsvpStatus;
  initialPartySize: number | null;
  initialNote: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RespondStatus | null>(
    initialStatus === "pending" ? null : (initialStatus as RespondStatus)
  );
  const [partySize, setPartySize] = useState(
    initialPartySize != null ? String(initialPartySize) : ""
  );
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialStatus !== "pending");

  async function submit(next: RespondStatus) {
    setBusy(true);
    setError(null);
    setStatus(next);

    const party =
      partySize.trim() === "" ? null : Number.parseInt(partySize.trim(), 10);

    const res = await fetch(`/api/portal/${token}/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: next,
        partySize: Number.isFinite(party) ? party : null,
        note,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save RSVP");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <p className="text-xs font-medium text-muted">
        {saved && status
          ? `Your RSVP: ${STATUS_LABELS[status]}`
          : "Will you attend?"}
      </p>
      <div className="flex flex-wrap gap-2">
        {(["yes", "maybe", "no"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status === value ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => void submit(value)}
          >
            {STATUS_LABELS[value]}
          </Button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-muted sm:w-28">
          Party size
          <input
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted flex-1 min-w-0">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for your teacher"
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </label>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {saved && status && (
        <p className="text-xs text-muted">
          Change your answer anytime. Update party size or note, then tap Yes /
          Maybe / No again.
        </p>
      )}
    </div>
  );
}
