import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudioPolicy } from "@/lib/schedule";
import { toLocalDateString } from "@/lib/schedule";
import {
  computeBadges,
  computeCurrentStreak,
  computeLongestStreak,
  mergePracticeDays,
  practiceDaysFromFlashcards,
  practiceDaysFromSessions,
  type StreakBadge,
  type StreakSettings,
} from "@/lib/streaks";

export type StudentStreakSummary = {
  currentStreak: number;
  longestStreak: number;
  badges: StreakBadge[];
  completedQuizCount: number;
};

function settingsFromPolicy(policy: StudioPolicy): StreakSettings {
  return {
    enabled: policy.streaks_enabled,
    countQuiz: policy.streak_count_quiz,
    countFreePractice: policy.streak_count_free_practice,
    countFlashcards: policy.streak_count_flashcards,
  };
}

/**
 * Load streak/badge summary for a student when streaks are enabled.
 * Returns null when streaks are off so callers can skip UI.
 */
export async function loadStudentStreakSummary(
  supabase: SupabaseClient,
  studentId: string,
  policy: StudioPolicy
): Promise<StudentStreakSummary | null> {
  if (!policy.streaks_enabled) return null;

  const settings = settingsFromPolicy(policy);
  const timeZone = policy.timezone;

  const { data: plans } = await supabase
    .from("student_plans")
    .select(
      `
      id,
      practice_sessions ( mode, completed_at ),
      flashcard_progress ( last_reviewed )
    `
    )
    .eq("student_id", studentId);

  const sessions: { mode: string; completed_at: string | null }[] = [];
  const flashUpdates: { updated_at: string }[] = [];

  for (const plan of plans ?? []) {
    for (const session of (plan.practice_sessions as
      | { mode: string; completed_at: string | null }[]
      | null) ?? []) {
      sessions.push(session);
    }
    if (settings.countFlashcards) {
      for (const row of (plan.flashcard_progress as
        | { last_reviewed: string | null }[]
        | null) ?? []) {
        if (row.last_reviewed) {
          flashUpdates.push({ updated_at: row.last_reviewed });
        }
      }
    }
  }

  const dayKeys = mergePracticeDays(
    practiceDaysFromSessions(sessions, settings, timeZone),
    practiceDaysFromFlashcards(flashUpdates, settings, timeZone)
  );

  const todayLocalKey = toLocalDateString(new Date(), timeZone);
  const currentStreak = computeCurrentStreak(dayKeys, todayLocalKey);
  const longestStreak = computeLongestStreak(dayKeys);
  const completedQuizCount = sessions.filter(
    (s) => s.mode === "lesson" && s.completed_at
  ).length;

  const badges = computeBadges({
    dayKeys,
    currentStreak,
    longestStreak,
    completedQuizCount,
  }).filter((b) => b.earned);

  return {
    currentStreak,
    longestStreak,
    badges,
    completedQuizCount,
  };
}
