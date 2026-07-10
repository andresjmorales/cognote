"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addDays,
  formatLessonTime,
  formatLessonDate,
  ATTENDANCE_LABELS,
} from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";

export interface WeekLesson {
  id: string;
  studentId: string;
  studentName: string;
  isAdHoc: boolean;
  isMakeup: boolean;
  lessonDate: string;
  startsAt: string;
  durationMinutes: number;
  attendance: { status: AttendanceStatus; noticeAt: string | null } | null;
  note: {
    body: string;
    privateBody: string;
    sharedWithParent: boolean;
    emailedAt: string | null;
  } | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  attended: "bg-success/10 text-success",
  teacher_cancel: "bg-warning/20 text-foreground",
  student_cancel: "bg-warning/20 text-foreground",
  no_show: "bg-error/10 text-error",
};

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function WeekView({
  weekStart,
  today,
  timezone,
  lessons,
  students,
  durationOptions,
}: {
  weekStart: string;
  today: string;
  timezone: string;
  lessons: WeekLesson[];
  students: { id: string; name: string }[];
  durationOptions: number[];
}) {
  const router = useRouter();
  const [openLesson, setOpenLesson] = useState<WeekLesson | null>(null);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Optimistic attendance overrides so cards update before the server
  // round-trip finishes (undefined = no override; null = cleared)
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, AttendanceStatus | null>
  >({});

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function markAttendance(lesson: WeekLesson, status: AttendanceStatus | null) {
    const hadOverride = lesson.id in statusOverrides;
    const previous = statusOverrides[lesson.id];
    setStatusOverrides((prev) => ({ ...prev, [lesson.id]: status }));
    setBusy(true);
    const res = await fetch(`/api/schedule/lessons/${lesson.id}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        if (hadOverride) next[lesson.id] = previous;
        else delete next[lesson.id];
        return next;
      });
      const data = await res.json().catch(() => ({}));
      notify(data.error ?? "Failed to save attendance");
    }
  }

  function effectiveStatus(lesson: WeekLesson): AttendanceStatus | null {
    return lesson.id in statusOverrides
      ? statusOverrides[lesson.id]
      : (lesson.attendance?.status ?? null);
  }

  async function deleteAdHoc(lesson: WeekLesson) {
    setBusy(true);
    const res = await fetch(`/api/schedule/lessons/${lesson.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setOpenLesson(null);
      router.refresh();
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, WeekLesson[]>();
  for (const lesson of lessons) {
    const list = byDay.get(lesson.lessonDate) ?? [];
    list.push(lesson);
    byDay.set(lesson.lessonDate, list);
  }

  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 6))}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?week=${addDays(weekStart, -7)}`}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface text-foreground hover:bg-surface-dim hover:border-primary/50 transition-colors"
            aria-label="Previous week"
          >
            <ChevronIcon direction="left" />
          </Link>
          <span className="font-medium text-sm min-w-24 text-center">{weekLabel}</span>
          <Link
            href={`/schedule?week=${addDays(weekStart, 7)}`}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface text-foreground hover:bg-surface-dim hover:border-primary/50 transition-colors"
            aria-label="Next week"
          >
            <ChevronIcon direction="right" />
          </Link>
          <Link
            href="/schedule"
            className="text-xs text-primary hover:underline ml-1"
          >
            Today
          </Link>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowAdHoc(true)}>
          Add One-off Lesson
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((date, i) => {
          const dayLessons = byDay.get(date) ?? [];
          const isToday = date === today;
          return (
            <div
              key={date}
              className={`rounded-xl border p-2 min-h-24 ${
                isToday ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <div
                className={`text-xs font-semibold mb-2 ${
                  isToday ? "text-primary" : "text-muted"
                }`}
              >
                {DAY_LABELS[i]} {fmtDate(date)}
              </div>
              <div className="space-y-1.5">
                {dayLessons.map((lesson) => {
                  const status = effectiveStatus(lesson);
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setOpenLesson(lesson)}
                      className="w-full text-left rounded-lg border border-border bg-background hover:border-primary/50 transition-colors p-2 cursor-pointer"
                    >
                      <div className="text-xs font-semibold truncate">
                        {lesson.studentName}
                        {lesson.isMakeup && (
                          <span className="text-primary font-normal"> · make-up</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {formatLessonTime(lesson.startsAt, timezone)} ·{" "}
                        {lesson.durationMinutes}m
                      </div>
                      {status && (
                        <div
                          className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${STATUS_STYLES[status]}`}
                        >
                          {ATTENDANCE_LABELS[status]}
                        </div>
                      )}
                      {lesson.note &&
                        (lesson.note.body.trim() ||
                          lesson.note.privateBody.trim()) && (
                        <div className="text-[10px] text-muted mt-0.5">
                          📝 note
                          {lesson.note.sharedWithParent
                            ? " · family"
                            : " · private"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {openLesson && (
        <LessonModal
          lesson={openLesson}
          currentStatus={effectiveStatus(openLesson)}
          timezone={timezone}
          busy={busy}
          onClose={() => setOpenLesson(null)}
          onMark={(status) => markAttendance(openLesson, status)}
          onDelete={() => deleteAdHoc(openLesson)}
          onSaved={() => {
            setOpenLesson(null);
            router.refresh();
          }}
          notify={notify}
        />
      )}

      {showAdHoc && (
        <AdHocModal
          students={students}
          durationOptions={durationOptions}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setShowAdHoc(false)}
          onSaved={() => {
            setShowAdHoc(false);
            router.refresh();
          }}
          notify={notify}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 6 15 12 9 18" />
      )}
    </svg>
  );
}

function LessonModal({
  lesson,
  currentStatus,
  timezone,
  busy,
  onClose,
  onMark,
  onDelete,
  onSaved,
  notify,
}: {
  lesson: WeekLesson;
  currentStatus: AttendanceStatus | null;
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onMark: (status: AttendanceStatus | null) => void;
  onDelete: () => void;
  onSaved: () => void;
  notify: (message: string) => void;
}) {
  const [familyBody, setFamilyBody] = useState(lesson.note?.body ?? "");
  const [privateBody, setPrivateBody] = useState(lesson.note?.privateBody ?? "");
  const [savingNote, setSavingNote] = useState(false);

  const hasAnyNote = Boolean(familyBody.trim() || privateBody.trim());
  const hadExistingNote = Boolean(
    lesson.note &&
      (lesson.note.body.trim() || lesson.note.privateBody.trim())
  );

  async function saveNote(sendEmail: boolean) {
    if (!hasAnyNote && !hadExistingNote) return;
    setSavingNote(true);
    const res = await fetch(`/api/schedule/lessons/${lesson.id}/note`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: familyBody,
        privateBody,
        sendEmail,
      }),
    });
    setSavingNote(false);
    if (res.ok) {
      const data = await res.json();
      if (sendEmail) {
        notify(
          data.emailed
            ? "Note emailed to the family"
            : (data.emailError ?? "Saved — email not sent")
        );
      }
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data.error ?? "Failed to save note");
    }
  }

  const statuses: AttendanceStatus[] = [
    "attended",
    "student_cancel",
    "teacher_cancel",
    "no_show",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1 gap-2">
          <h3 className="font-semibold text-lg">{lesson.studentName}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-success hover:bg-success/10 cursor-pointer flex items-center justify-center"
              aria-label="Done"
              title="Done — confirm and close"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-surface-dim cursor-pointer flex items-center justify-center text-xl leading-none"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
        <p className="text-sm text-muted mb-4">
          {formatLessonDate(lesson.startsAt, timezone, "long")} at{" "}
          {formatLessonTime(lesson.startsAt, timezone)} · {lesson.durationMinutes} min
          {lesson.isMakeup && " · make-up lesson"}
        </p>

        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Attendance
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {statuses.map((status) => {
            const active = currentStatus === status;
            return (
              <Button
                key={status}
                size="sm"
                variant={active ? "primary" : "secondary"}
                disabled={busy}
                onClick={() => onMark(status)}
              >
                {ATTENDANCE_LABELS[status]}
              </Button>
            );
          })}
        </div>
        {currentStatus && (
          <button
            onClick={() => onMark(null)}
            className="text-xs text-muted hover:text-foreground underline cursor-pointer mb-2"
          >
            Clear attendance
          </button>
        )}

        <hr className="border-border my-4" />

        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
          Private notes
        </label>
        <textarea
          value={privateBody}
          onChange={(e) => setPrivateBody(e.target.value)}
          placeholder="Teacher-only — not shown to the family"
          rows={3}
          className={inputClass}
        />

        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1 mt-3">
          Notes for student / parent
        </label>
        <textarea
          value={familyBody}
          onChange={(e) => setFamilyBody(e.target.value)}
          placeholder="Shown in the family portal — practice this week…"
          rows={4}
          className={inputClass}
        />
        {lesson.note?.emailedAt && (
          <p className="text-xs text-muted mt-1">
            Emailed {formatLessonDate(lesson.note.emailedAt, timezone)}
          </p>
        )}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            disabled={savingNote || (!hasAnyNote && !hadExistingNote)}
            onClick={() => saveNote(false)}
          >
            {savingNote ? "Saving..." : "Save Notes"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={savingNote || !familyBody.trim()}
            onClick={() => saveNote(true)}
            title={
              !familyBody.trim()
                ? "Add notes for student/parent to email the family"
                : undefined
            }
          >
            Save &amp; Email Family
          </Button>
        </div>

        {lesson.isAdHoc && (
          <>
            <hr className="border-border my-4" />
            <button
              onClick={onDelete}
              disabled={busy}
              className="text-xs text-error hover:underline cursor-pointer"
            >
              Delete this one-off lesson
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

function AdHocModal({
  students,
  durationOptions,
  busy,
  setBusy,
  onClose,
  onSaved,
  notify,
}: {
  students: { id: string; name: string }[];
  durationOptions: number[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string) => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [duration, setDuration] = useState(durationOptions[0] ?? 30);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/schedule/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, date, time, durationMinutes: duration }),
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data.error ?? "Failed to schedule lesson");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-sm w-full">
        <h3 className="font-semibold mb-3">One-off Lesson</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={inputClass}
            required
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
              required
            />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            >
              {durationOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !studentId || !date}>
              {busy ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
