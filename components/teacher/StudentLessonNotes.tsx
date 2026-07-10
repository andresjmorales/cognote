"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatShortDate } from "@/lib/schedule";

export type StudentLessonNote = {
  id: string;
  body: string;
  privateBody: string;
  sharedWithParent: boolean;
  emailedAt: string | null;
  lessonDate: string;
  updatedAt: string;
};

const PREVIEW_COUNT = 5;

export function StudentLessonNotes({
  notes,
  timezone,
}: {
  notes: StudentLessonNote[];
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? notes : notes.slice(0, PREVIEW_COUNT);
  const hiddenCount = notes.length - PREVIEW_COUNT;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Lesson Notes</h2>
      {notes.length === 0 ? (
        <Card className="text-center text-muted text-sm">
          No lesson notes yet. Add them from the schedule after a lesson.
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((note) => {
            const hasFamily = Boolean(note.body.trim());
            const hasPrivate = Boolean(note.privateBody.trim());
            return (
              <Card key={note.id} padding="sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-2">
                  <span>
                    {formatShortDate(`${note.lessonDate}T12:00:00`, timezone)}
                  </span>
                  {hasFamily && (
                    <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">
                      Family
                    </span>
                  )}
                  {hasPrivate && (
                    <span className="rounded bg-surface-dim text-muted px-1.5 py-0.5">
                      Private
                    </span>
                  )}
                  {note.emailedAt && <span>Emailed</span>}
                </div>
                {hasPrivate && (
                  <div className="mb-2">
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-0.5">
                      Private
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{note.privateBody}</p>
                  </div>
                )}
                {hasFamily && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-0.5">
                      For student / parent
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                  </div>
                )}
              </Card>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              {expanded ? "Show less" : `Show more (${hiddenCount})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
