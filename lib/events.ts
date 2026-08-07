import {
  addDays,
  formatLessonDate,
  formatLessonTime,
  toLocalDateString,
} from "@/lib/schedule";

/**
 * Human-readable when for an event in the studio timezone.
 * e.g. "Saturday, July 12, 2026 at 3:00 PM"
 * or with end: "Saturday, July 12, 2026 · 3:00–4:30 PM"
 */
export function formatEventWhen(
  startsAt: string,
  endsAt: string | null | undefined,
  timezone: string
): string {
  const date = formatEventDate(startsAt, timezone);
  const startTime = formatLessonTime(startsAt, timezone);

  if (!endsAt) {
    return `${date} at ${startTime}`;
  }

  const endTime = formatLessonTime(endsAt, timezone);
  const sameDay =
    formatEventDateKey(startsAt, timezone) ===
    formatEventDateKey(endsAt, timezone);

  if (sameDay) {
    return `${date} · ${startTime}–${endTime}`;
  }

  return `${date} at ${startTime} – ${formatEventDate(endsAt, timezone)} at ${endTime}`;
}

/** e.g. "Saturday, July 12, 2026" */
export function formatEventDate(iso: string, timezone: string): string {
  const base = formatLessonDate(iso, timezone, "long");
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(iso));
  return `${base}, ${year}`;
}

/** YYYY-MM-DD in the given IANA timezone (for calendar day grouping). */
export function formatEventDateKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * True when `now` falls on the studio-local calendar day before the event's
 * local start date (used by the daily reminder cron).
 */
export function isEventReminderDay(
  startsAt: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  const eventLocalDate = formatEventDateKey(startsAt, timezone);
  const todayLocal = toLocalDateString(now, timezone);
  return todayLocal === addDays(eventLocalDate, -1);
}

/** Convert an ISO timestamp to a value for `<input type="datetime-local">`. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local input into an ISO UTC string. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/**
 * When endsAt is set, it must be strictly after startsAt.
 * Returns an error message or null if valid / no end time.
 */
export function validateEventEndAfterStart(
  startsAt: string,
  endsAt: string | null | undefined
): string | null {
  if (!endsAt?.trim()) return null;
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (endMs <= startMs) {
    return "End time must be after the start time";
  }
  return null;
}
