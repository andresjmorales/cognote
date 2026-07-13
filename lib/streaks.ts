import { addDays, toLocalDateString } from "@/lib/schedule";

export type StreakSettings = {
  enabled: boolean;
  countQuiz: boolean;
  countFreePractice: boolean;
  countFlashcards: boolean;
};

export type StreakBadge = {
  id: string;
  label: string;
  earned: boolean;
};

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateKey(
  isoOrDate: string | Date,
  timeZone: string
): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return toLocalDateString(date, timeZone);
}

export function practiceDaysFromSessions(
  sessions: { mode: string; completed_at: string | null }[],
  settings: StreakSettings,
  timeZone: string
): Set<string> {
  const days = new Set<string>();
  if (!settings.enabled) return days;

  for (const session of sessions) {
    if (!session.completed_at) continue;
    const counts =
      (session.mode === "lesson" && settings.countQuiz) ||
      (session.mode === "free_practice" && settings.countFreePractice);
    if (!counts) continue;
    days.add(localDateKey(session.completed_at, timeZone));
  }
  return days;
}

export function practiceDaysFromFlashcards(
  updates: { updated_at: string }[],
  settings: StreakSettings,
  timeZone: string
): Set<string> {
  const days = new Set<string>();
  if (!settings.enabled || !settings.countFlashcards) return days;

  for (const row of updates) {
    days.add(localDateKey(row.updated_at, timeZone));
  }
  return days;
}

/** Merge practice-day sets into a sorted ascending YYYY-MM-DD list. */
export function mergePracticeDays(...sets: Set<string>[]): string[] {
  const merged = new Set<string>();
  for (const set of sets) {
    for (const day of set) merged.add(day);
  }
  return [...merged].sort();
}

/**
 * Consecutive practice days ending today, or yesterday if nothing today yet
 * (Duolingo-style grace).
 */
export function computeCurrentStreak(
  dayKeysSortedAsc: string[],
  todayLocalKey: string
): number {
  if (dayKeysSortedAsc.length === 0) return 0;

  const practiced = new Set(dayKeysSortedAsc);
  const yesterday = addDays(todayLocalKey, -1);

  let tip: string | null = null;
  if (practiced.has(todayLocalKey)) tip = todayLocalKey;
  else if (practiced.has(yesterday)) tip = yesterday;
  else return 0;

  let streak = 0;
  let cursor = tip;
  while (practiced.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function computeLongestStreak(dayKeysSortedAsc: string[]): number {
  if (dayKeysSortedAsc.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayKeysSortedAsc.length; i++) {
    const prev = dayKeysSortedAsc[i - 1];
    const cur = dayKeysSortedAsc[i];
    if (cur === addDays(prev, 1)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

export function computeBadges(args: {
  dayKeys: string[];
  currentStreak: number;
  longestStreak: number;
  completedQuizCount: number;
}): StreakBadge[] {
  const { longestStreak, completedQuizCount } = args;
  return [
    {
      id: "first_quiz",
      label: "First quiz",
      earned: completedQuizCount >= 1,
    },
    {
      id: "streak_3",
      label: "3-day streak",
      earned: longestStreak >= 3,
    },
    {
      id: "streak_7",
      label: "7-day streak",
      earned: longestStreak >= 7,
    },
    {
      id: "streak_30",
      label: "30-day streak",
      earned: longestStreak >= 30,
    },
    {
      id: "quizzes_10",
      label: "10 quizzes",
      earned: completedQuizCount >= 10,
    },
    {
      id: "quizzes_50",
      label: "50 quizzes",
      earned: completedQuizCount >= 50,
    },
  ];
}
