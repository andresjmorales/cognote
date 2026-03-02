/**
 * SM-2 spaced repetition algorithm.
 *
 * Rating scale: Again = 1, Hard = 2, Good = 4, Easy = 5
 */

export interface FlashcardState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export type SRSRating = 1 | 2 | 4 | 5;

/** Anki-style labels (used in documentation / analytics) */
export const SRS_LABELS: Record<SRSRating, string> = {
  1: "Again",
  2: "Hard",
  4: "Good",
  5: "Easy",
};

/** Kid-friendly labels shown in the student UI */
export const SRS_KID_LABELS: Record<SRSRating, { emoji: string; text: string }> = {
  1: { emoji: "😕", text: "No clue" },
  2: { emoji: "🤔", text: "Tricky" },
  4: { emoji: "👍", text: "Got it!" },
  5: { emoji: "⭐", text: "Too easy!" },
};

const MIN_EASE_FACTOR = 1.3;

export function nextReviewState(
  current: FlashcardState,
  rating: SRSRating
): FlashcardState {
  let { easeFactor, intervalDays, repetitions } = current;

  if (rating >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }

  easeFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  );

  return { easeFactor, intervalDays, repetitions };
}

export function nextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  return d;
}

export function defaultFlashcardState(): FlashcardState {
  return { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
}
