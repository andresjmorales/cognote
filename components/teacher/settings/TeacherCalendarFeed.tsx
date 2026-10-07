"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";

/**
 * Read-only calendar feed controls. The URL is public and token-gated; the
 * only revocation is rotation, so the reset button is the security control.
 */
export function TeacherCalendarFeed({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const feedPath = `/api/feeds/${token}/calendar`;

  async function handleReset() {
    setBusy(true);
    const res = await fetch("/api/teacher/calendar-token", { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <Card>
      <h2 className="font-semibold mb-1">Calendar feed</h2>
      <p className="text-sm text-muted mb-3">
        Subscribe to your lessons and studio events from Google, Apple, or
        Outlook Calendar. It is read-only and stays up to date, but anyone
        with the link can see your schedule — keep it private.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <CopyLinkClient
          url={feedPath}
          title="Teacher calendar feed"
          label="Feed Link"
        />
        <a
          href={feedPath}
          download
          className="inline-flex items-center justify-center font-semibold bg-surface border border-border text-foreground hover:border-primary/50 px-3 py-1.5 text-xs rounded-lg transition-colors"
        >
          Download .ics
        </a>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={handleReset}
          title="Generate a new feed link. The old one stops working."
        >
          Reset Feed Link
        </Button>
      </div>
    </Card>
  );
}
