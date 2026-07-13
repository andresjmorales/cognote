import { describe, it, expect } from "vitest";
import {
  computeBadges,
  computeCurrentStreak,
  computeLongestStreak,
  localDateKey,
  mergePracticeDays,
  practiceDaysFromFlashcards,
  practiceDaysFromSessions,
  type StreakSettings,
} from "@/lib/streaks";

const TZ = "America/Chicago";

const allOn: StreakSettings = {
  enabled: true,
  countQuiz: true,
  countFreePractice: true,
  countFlashcards: true,
};

describe("localDateKey", () => {
  it("formats ISO timestamps in the studio timezone", () => {
    // 2026-01-15 05:00 UTC → still Jan 14 in Chicago (CST, UTC-6)
    expect(localDateKey("2026-01-15T05:00:00.000Z", TZ)).toBe("2026-01-14");
    expect(localDateKey("2026-01-15T12:00:00.000Z", TZ)).toBe("2026-01-15");
  });
});

describe("practice day sources", () => {
  it("counts completed quiz/free-practice sessions per settings", () => {
    const sessions = [
      { mode: "lesson", completed_at: "2026-03-01T18:00:00.000Z" },
      { mode: "free_practice", completed_at: "2026-03-02T18:00:00.000Z" },
      { mode: "lesson", completed_at: null },
      { mode: "flashcard", completed_at: "2026-03-03T18:00:00.000Z" },
    ];
    const quizOnly: StreakSettings = {
      ...allOn,
      countFreePractice: false,
      countFlashcards: false,
    };
    const days = practiceDaysFromSessions(sessions, quizOnly, "UTC");
    expect([...days].sort()).toEqual(["2026-03-01"]);
  });

  it("counts flashcard updates when enabled", () => {
    const days = practiceDaysFromFlashcards(
      [
        { updated_at: "2026-03-01T12:00:00.000Z" },
        { updated_at: "2026-03-01T20:00:00.000Z" },
        { updated_at: "2026-03-04T12:00:00.000Z" },
      ],
      allOn,
      "UTC"
    );
    expect([...days].sort()).toEqual(["2026-03-01", "2026-03-04"]);
  });

  it("returns empty when streaks are disabled", () => {
    const off: StreakSettings = { ...allOn, enabled: false };
    expect(
      practiceDaysFromSessions(
        [{ mode: "lesson", completed_at: "2026-03-01T12:00:00.000Z" }],
        off,
        "UTC"
      ).size
    ).toBe(0);
  });
});

describe("mergePracticeDays", () => {
  it("unions and sorts ascending", () => {
    expect(
      mergePracticeDays(
        new Set(["2026-03-03", "2026-03-01"]),
        new Set(["2026-03-02", "2026-03-01"])
      )
    ).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });
});

describe("computeCurrentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      computeCurrentStreak(
        ["2026-03-01", "2026-03-02", "2026-03-03"],
        "2026-03-03"
      )
    ).toBe(3);
  });

  it("keeps the streak through yesterday when nothing today yet", () => {
    expect(
      computeCurrentStreak(
        ["2026-03-01", "2026-03-02"],
        "2026-03-03"
      )
    ).toBe(2);
  });

  it("is zero when the last practice was before yesterday", () => {
    expect(
      computeCurrentStreak(["2026-03-01"], "2026-03-03")
    ).toBe(0);
  });

  it("ignores older gaps when counting from the tip", () => {
    expect(
      computeCurrentStreak(
        ["2026-02-20", "2026-03-01", "2026-03-02", "2026-03-03"],
        "2026-03-03"
      )
    ).toBe(3);
  });
});

describe("computeLongestStreak", () => {
  it("finds the longest consecutive run", () => {
    expect(
      computeLongestStreak([
        "2026-03-01",
        "2026-03-02",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
      ])
    ).toBe(3);
  });

  it("returns 0 for an empty list", () => {
    expect(computeLongestStreak([])).toBe(0);
  });
});

describe("computeBadges", () => {
  it("marks quiz and streak milestones as earned", () => {
    const badges = computeBadges({
      dayKeys: ["2026-03-01", "2026-03-02", "2026-03-03"],
      currentStreak: 3,
      longestStreak: 3,
      completedQuizCount: 12,
    });
    const byId = Object.fromEntries(badges.map((b) => [b.id, b.earned]));
    expect(byId.first_quiz).toBe(true);
    expect(byId.streak_3).toBe(true);
    expect(byId.streak_7).toBe(false);
    expect(byId.streak_30).toBe(false);
    expect(byId.quizzes_10).toBe(true);
    expect(byId.quizzes_50).toBe(false);
  });
});
