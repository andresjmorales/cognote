"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ATTENDANCE_LABELS, formatShortDate, formatLessonDate } from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";

export interface MakeupCredit {
  attendanceId: string;
  status: AttendanceStatus;
  studentId: string;
  studentName: string;
  missedAt: string;
  durationMinutes: number;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function MakeupPanel({
  credits,
  timezone,
}: {
  credits: MakeupCredit[];
  timezone: string;
}) {
  const router = useRouter();
  const [scheduling, setScheduling] = useState<MakeupCredit | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byStudent = new Map<
      string,
      { studentId: string; studentName: string; credits: MakeupCredit[] }
    >();
    for (const credit of credits) {
      const existing = byStudent.get(credit.studentId);
      if (existing) {
        existing.credits.push(credit);
      } else {
        byStudent.set(credit.studentId, {
          studentId: credit.studentId,
          studentName: credit.studentName,
          credits: [credit],
        });
      }
    }
    return Array.from(byStudent.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  }, [credits]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduling) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/schedule/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: scheduling.studentId,
        date,
        time,
        durationMinutes: scheduling.durationMinutes,
        makeupFor: scheduling.attendanceId,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setScheduling(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to schedule make-up");
    }
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Make-up Credits</h2>
      {credits.length === 0 ? (
        <p className="text-sm text-muted">
          No unused make-up credits. Cancellations that earn one (per your studio
          policy below) show up here.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.studentId}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold">{group.studentName}</h3>
                <span className="text-xs text-muted">
                  {group.credits.length} credit
                  {group.credits.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-1.5 pl-0 sm:pl-1 border-l-2 border-border/80 sm:ml-0.5 sm:pl-3">
                {group.credits.map((credit) => (
                  <div
                    key={credit.attendanceId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted">
                      {ATTENDANCE_LABELS[credit.status]} ·{" "}
                      {formatShortDate(credit.missedAt, timezone)}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setScheduling(credit)}
                    >
                      Schedule
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {scheduling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full">
            <h3 className="font-semibold mb-1">Make-up for {scheduling.studentName}</h3>
            <p className="text-xs text-muted mb-3">
              Replaces the {ATTENDANCE_LABELS[scheduling.status].toLowerCase()} lesson from{" "}
              {formatLessonDate(scheduling.missedAt, timezone, "long")}. Each credit can
              be used once.
            </p>
            <form onSubmit={handleSchedule} className="flex flex-col gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
                required
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
                required
              />
              {error && <p className="text-error text-xs">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setScheduling(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy || !date}>
                  {busy ? "Scheduling..." : "Schedule"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}
