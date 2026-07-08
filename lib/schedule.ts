import type { AttendanceStatus } from "@/lib/supabase/types";

/**
 * Scheduling helpers (ROADMAP Phase 2).
 *
 * Slots store LOCAL day/time; the studio's IANA timezone lives on
 * studio_policies. Each occurrence is converted to a concrete UTC instant
 * individually, so a 4:00 PM Tuesday lesson stays 4:00 PM local across DST.
 */

export interface StudioPolicy {
  timezone: string;
  cancellation_window_hours: number;
  timely_cancel_earns_makeup: boolean;
  late_cancel_earns_makeup: boolean;
  no_show_earns_makeup: boolean;
  teacher_cancel_earns_makeup: boolean;
  makeup_credit_expiry_days: number | null;
}

export const DEFAULT_POLICY: StudioPolicy = {
  timezone: "America/Chicago",
  cancellation_window_hours: 24,
  timely_cancel_earns_makeup: true,
  late_cancel_earns_makeup: false,
  no_show_earns_makeup: false,
  teacher_cancel_earns_makeup: true,
  makeup_credit_expiry_days: null,
};

/** Offset (ms) of `timeZone` from UTC at the instant `ts` (UTC ms). */
function tzOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // Intl can report "24" at midnight
    get("minute"),
    get("second")
  );
  return asUtc - ts;
}

/**
 * Convert a local wall-clock time in an IANA timezone to a UTC Date.
 * Two-pass: the first guess may sit on the wrong side of a DST transition.
 */
export function zonedTimeToUtc(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:mm" or "HH:mm:ss"
  timeZone: string
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  let offset = tzOffsetMs(utcGuess, timeZone);
  const secondPass = tzOffsetMs(utcGuess - offset, timeZone);
  if (secondPass !== offset) offset = secondPass;
  return new Date(utcGuess - offset);
}

/** "YYYY-MM-DD" for a Date interpreted in the given timezone. */
export function toLocalDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" local date. */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Start (Sunday) of the week containing the given local date. */
export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr));
}

export interface SlotRow {
  id: string;
  teacher_id: string;
  student_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

export interface OccurrenceInsert {
  teacher_id: string;
  student_id: string;
  slot_id: string;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
}

/**
 * Compute the occurrences a slot produces in [from, to] (inclusive local
 * dates). Pure function — the caller upserts with ON CONFLICT (slot_id,
 * lesson_date) DO NOTHING so materialization stays idempotent.
 */
export function computeOccurrences(
  slot: SlotRow,
  from: string,
  to: string,
  timeZone: string
): OccurrenceInsert[] {
  if (!slot.active) return [];
  const rangeStart = slot.start_date > from ? slot.start_date : from;
  const rangeEnd = slot.end_date && slot.end_date < to ? slot.end_date : to;
  if (rangeStart > rangeEnd) return [];

  // First occurrence on/after rangeStart that falls on the slot's weekday
  const first = addDays(
    rangeStart,
    (slot.day_of_week - dayOfWeek(rangeStart) + 7) % 7
  );

  const occurrences: OccurrenceInsert[] = [];
  for (let date = first; date <= rangeEnd; date = addDays(date, 7)) {
    occurrences.push({
      teacher_id: slot.teacher_id,
      student_id: slot.student_id,
      slot_id: slot.id,
      lesson_date: date,
      starts_at: zonedTimeToUtc(date, slot.start_time, timeZone).toISOString(),
      duration_minutes: slot.duration_minutes,
    });
  }
  return occurrences;
}

/**
 * Whether a cancellation/no-show earns a make-up credit under the policy.
 * Policy is an input, never baked in (ROADMAP §3).
 */
export function earnsMakeupCredit(
  status: AttendanceStatus,
  noticeAt: string | null,
  lessonStartsAt: string,
  policy: StudioPolicy
): boolean {
  switch (status) {
    case "attended":
      return false;
    case "teacher_cancel":
      return policy.teacher_cancel_earns_makeup;
    case "no_show":
      return policy.no_show_earns_makeup;
    case "student_cancel": {
      const windowMs = policy.cancellation_window_hours * 60 * 60 * 1000;
      const notice = noticeAt ? new Date(noticeAt).getTime() : Date.now();
      const timely = new Date(lessonStartsAt).getTime() - notice >= windowMs;
      return timely
        ? policy.timely_cancel_earns_makeup
        : policy.late_cancel_earns_makeup;
    }
  }
}

/** Whether a make-up credit earned at `earnedAt` is still valid under the policy. */
export function creditIsValid(earnedAt: string, policy: StudioPolicy): boolean {
  if (policy.makeup_credit_expiry_days === null) return true;
  const expiresAt =
    new Date(earnedAt).getTime() +
    policy.makeup_credit_expiry_days * 24 * 60 * 60 * 1000;
  return Date.now() < expiresAt;
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  attended: "Attended",
  teacher_cancel: "Teacher cancelled",
  student_cancel: "Student cancelled",
  no_show: "No-show",
};

/**
 * Normalize a PostgREST embed that is logically one-to-one (unique FK) but
 * may arrive as an object or a single-element array depending on how the
 * relationship was detected.
 */
export function oneToOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Date/time display helpers assembled manually from formatToParts.
 * toLocaleTimeString output is NOT byte-stable across ICU versions (e.g.
 * "4:00 PM" with a narrow no-break space vs a regular space), which causes
 * React hydration mismatches when Node and the browser disagree. Building
 * the string ourselves keeps server and client output identical.
 */
function partsOf(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** e.g. "4:00 PM" */
export function formatLessonTime(startsAt: string, timeZone: string): string {
  const p = partsOf(new Date(startsAt), timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** e.g. "Tue, Jul 7" (short) or "Tuesday, July 7" (long) */
export function formatLessonDate(
  startsAt: string,
  timeZone: string,
  style: "short" | "long" = "short"
): string {
  const p = partsOf(new Date(startsAt), timeZone, {
    weekday: style,
    month: style,
    day: "numeric",
  });
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** e.g. "Jul 7" */
export function formatShortDate(startsAt: string, timeZone: string): string {
  const p = partsOf(new Date(startsAt), timeZone, {
    month: "short",
    day: "numeric",
  });
  return `${p.month} ${p.day}`;
}
