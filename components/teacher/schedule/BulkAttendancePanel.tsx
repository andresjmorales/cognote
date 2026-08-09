"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ATTENDANCE_LABELS,
  BULK_ATTENDANCE_STATUSES,
  formatLessonDate,
  formatLessonTime,
} from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";
import type { WeekLesson } from "@/components/teacher/schedule/WeekView";

export function BulkAttendancePanel({
  lessons,
  timezone,
}: {
  lessons: WeekLesson[];
  timezone: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifyFamily, setNotifyFamily] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...lessons].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [lessons]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((l) => l.id)));
  }

  async function apply(status: AttendanceStatus) {
    if (selected.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ids: [...selected],
          notifyFamily: status === "teacher_cancel" ? notifyFamily : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Bulk update failed", "error");
        return;
      }
      const emailBit =
        status === "teacher_cancel" && notifyFamily
          ? ` · emailed ${data.emailed ?? 0} famil${(data.emailed ?? 0) === 1 ? "y" : "ies"}`
          : "";
      setMessage(
        `Marked ${data.succeeded} lesson${data.succeeded === 1 ? "" : "s"} as ${ATTENDANCE_LABELS[status].toLowerCase()}${emailBit}.`
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      showToast("Bulk update failed. Check your connection.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-primary hover:underline cursor-pointer"
        >
          Bulk mark attendance…
        </button>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold">Bulk attendance</h2>
          <p className="text-xs text-muted mt-0.5">
            Select lessons and apply Attended, No-show, or Teacher cancelled.
            Teacher cancelled emails each family by default. Student
            cancellations stay on the lesson dialog (need a notice time).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected(new Set());
            setMessage(null);
          }}
          className="text-sm text-muted hover:text-foreground cursor-pointer"
        >
          Close
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No lessons this week.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === sorted.length && sorted.length > 0}
              onChange={toggleAll}
            />
            Select all ({sorted.length})
          </label>
          <div className="max-h-64 overflow-y-auto space-y-1 mb-3 border border-border rounded-lg p-2">
            {sorted.map((lesson) => {
              const status = lesson.attendance?.status;
              return (
                <label
                  key={lesson.id}
                  className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-surface-dim cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(lesson.id)}
                    onChange={() => toggle(lesson.id)}
                  />
                  <span className="flex-1 min-w-0 truncate">
                    {lesson.studentName} ·{" "}
                    {formatLessonDate(lesson.startsAt, timezone)}{" "}
                    {formatLessonTime(lesson.startsAt, timezone)}
                  </span>
                  {status && (
                    <span className="text-xs text-muted shrink-0">
                      {ATTENDANCE_LABELS[status]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {BULK_ATTENDANCE_STATUSES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant="secondary"
                disabled={busy || selected.size === 0}
                onClick={() => void apply(status)}
              >
                Mark {ATTENDANCE_LABELS[status]}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyFamily}
              onChange={(e) => setNotifyFamily(e.target.checked)}
            />
            Email families when marking Teacher cancelled
          </label>
        </>
      )}
      {message && <p className="text-sm text-muted mt-3">{message}</p>}
    </Card>
  );
}
