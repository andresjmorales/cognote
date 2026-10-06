import { isDateString, zonedTimeToUtc } from "@/lib/schedule";

export interface LessonMoveInput {
  date?: string;
  time?: string;
  durationMinutes?: number;
}

export interface MovableLesson {
  slot_id: string | null;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
  rescheduled_from_date: string | null;
}

export interface LessonMovePatch {
  lesson_date?: string;
  starts_at?: string;
  duration_minutes?: number;
  rescheduled_from_date?: string | null;
}

export type LessonMovePlan =
  | { ok: true; patch: LessonMovePatch; dateChanged: boolean }
  | { ok: false; error: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function localTimeInput(startsAt: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(startsAt));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

export function planLessonMove(
  input: LessonMoveInput,
  lesson: MovableLesson,
  timeZone: string
): LessonMovePlan {
  const patch: LessonMovePatch = {};
  let nextDate = lesson.lesson_date;
  let dateChanged = false;

  if (input.date !== undefined) {
    if (!isDateString(input.date)) {
      return { ok: false, error: "date must be a YYYY-MM-DD calendar date" };
    }
    if (input.date !== lesson.lesson_date) dateChanged = true;
    nextDate = input.date;
    patch.lesson_date = input.date;
  }

  if (input.time !== undefined && !TIME_RE.test(input.time)) {
    return { ok: false, error: "time must be HH:mm (24-hour)" };
  }

  if (input.durationMinutes !== undefined) {
    const minutes = Number(input.durationMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return { ok: false, error: "durationMinutes must be a positive whole number" };
    }
    patch.duration_minutes = minutes;
  }

  if (input.date !== undefined || input.time !== undefined) {
    const time = input.time ?? localTimeInput(lesson.starts_at, timeZone);
    patch.starts_at = zonedTimeToUtc(nextDate, time, timeZone).toISOString();
  }

  if (dateChanged && lesson.slot_id) {
    if (lesson.rescheduled_from_date && nextDate === lesson.rescheduled_from_date) {
      patch.rescheduled_from_date = null;
    } else {
      patch.rescheduled_from_date =
        lesson.rescheduled_from_date ?? lesson.lesson_date;
    }
  }

  return { ok: true, patch, dateChanged };
}

export function rescheduleSkipKeys(
  rows: { slot_id: string | null; rescheduled_from_date: string | null }[]
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.slot_id && row.rescheduled_from_date) {
      keys.add(`${row.slot_id}|${row.rescheduled_from_date}`);
    }
  }
  return keys;
}

export interface MoveConflictInput {
  studentId: string;
  startsAt: string;
  durationMinutes: number;
}

export interface MoveConflicts {
  studentOverlap: boolean;
  teacherOverlap: boolean;
}

function overlaps(a: MoveConflictInput, b: MoveConflictInput): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = aStart + a.durationMinutes * 60_000;
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = bStart + b.durationMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

export function findMoveConflicts(
  target: MoveConflictInput,
  others: MoveConflictInput[]
): MoveConflicts {
  let studentOverlap = false;
  let teacherOverlap = false;
  for (const other of others) {
    if (!overlaps(target, other)) continue;
    teacherOverlap = true;
    if (other.studentId === target.studentId) studentOverlap = true;
  }
  return { studentOverlap, teacherOverlap };
}
