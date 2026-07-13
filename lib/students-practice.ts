/**
 * Helpers for students.practice_start_date.
 * Year-only entries are stored as YYYY-01-01; exact dates keep month/day.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePracticeStartParts(
  dateString: string
): [number, number, number] | null {
  const match = DATE_RE.exec(dateString);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when the stored date is a year-only sentinel (Jan 1). */
export function isYearOnlyPracticeStart(dateString: string): boolean {
  const parts = parsePracticeStartParts(dateString);
  if (!parts) return false;
  const [, month, day] = parts;
  return month === 1 && day === 1;
}

/** Store a year-only value as YYYY-01-01. */
export function yearToPracticeStartDate(year: number): string {
  return `${year}-01-01`;
}

/**
 * Human display: "since 2021" for year-only, "since Jan 2024" / "since Jan 15, 2024"
 * for precise dates, plus optional "~N years".
 */
export function formatPracticeSince(
  dateString: string,
  now: Date = new Date()
): string {
  const parts = parsePracticeStartParts(dateString);
  if (!parts) return dateString;
  const [year, month, day] = parts;
  const years = yearsSincePracticeStart(dateString, now);

  let since: string;
  if (isYearOnlyPracticeStart(dateString)) {
    since = `since ${year}`;
  } else if (day === 1) {
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
      undefined,
      { month: "short", year: "numeric" }
    );
    since = `since ${monthLabel}`;
  } else {
    const full = new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    since = `since ${full}`;
  }

  if (years === null) return since;
  if (years < 1) return since;
  if (years === 1) return `${since} (~1 year)`;
  return `${since} (~${years} years)`;
}

export function yearsSincePracticeStart(
  dateString: string,
  now: Date = new Date()
): number | null {
  const parts = parsePracticeStartParts(dateString);
  if (!parts) return null;
  const [year, month, day] = parts;
  let years = now.getFullYear() - year;
  const hadAnniversary =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadAnniversary) years--;
  return years >= 0 && years < 130 ? years : null;
}

/** Convert created_at ISO timestamp to a local YYYY-MM-DD for "use add date". */
export function createdAtToPracticeStartDate(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
