import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  toLocalDateString,
  dayOfWeek,
  addDays,
  startOfWeek,
  computeOccurrences,
  earnsMakeupCredit,
  creditIsValid,
  formatLessonTime,
  formatLessonDate,
  oneToOne,
  DEFAULT_POLICY,
  type SlotRow,
} from "@/lib/schedule";

// America/Chicago in 2026: CST (UTC-6) until March 8, CDT (UTC-5) until Nov 1.
const CHICAGO = "America/Chicago";

const baseSlot: SlotRow = {
  id: "slot-1",
  teacher_id: "t-1",
  student_id: "s-1",
  day_of_week: 2, // Tuesday
  start_time: "16:00",
  duration_minutes: 30,
  start_date: "2026-01-01",
  end_date: null,
  active: true,
};

describe("zonedTimeToUtc", () => {
  it("converts winter (CST, UTC-6) wall-clock time", () => {
    expect(zonedTimeToUtc("2026-01-13", "16:00", CHICAGO).toISOString()).toBe(
      "2026-01-13T22:00:00.000Z"
    );
  });

  it("converts summer (CDT, UTC-5) wall-clock time", () => {
    expect(zonedTimeToUtc("2026-07-07", "16:00", CHICAGO).toISOString()).toBe(
      "2026-07-07T21:00:00.000Z"
    );
  });

  it("handles the spring-forward day itself (Mar 8, 2026)", () => {
    // 16:00 local on the transition day is already CDT
    expect(zonedTimeToUtc("2026-03-08", "16:00", CHICAGO).toISOString()).toBe(
      "2026-03-08T21:00:00.000Z"
    );
  });

  it("handles the fall-back day itself (Nov 1, 2026)", () => {
    // 16:00 local on the transition day is already CST again
    expect(zonedTimeToUtc("2026-11-01", "16:00", CHICAGO).toISOString()).toBe(
      "2026-11-01T22:00:00.000Z"
    );
  });
});

describe("toLocalDateString", () => {
  it("reports the studio-local date, not the UTC date", () => {
    // 9 PM Chicago on July 8 is 2 AM UTC on July 9 — the classic
    // "materialized tomorrow's lesson" bug this helper exists to prevent.
    const usEvening = new Date("2026-07-09T02:00:00Z");
    expect(toLocalDateString(usEvening, CHICAGO)).toBe("2026-07-08");
  });

  it("matches UTC when the instant is midday", () => {
    expect(toLocalDateString(new Date("2026-07-08T17:00:00Z"), CHICAGO)).toBe(
      "2026-07-08"
    );
  });
});

describe("date string helpers", () => {
  it("dayOfWeek: 2026-07-08 is a Wednesday", () => {
    expect(dayOfWeek("2026-07-08")).toBe(3);
  });

  it("addDays rolls over months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("startOfWeek returns the containing Sunday", () => {
    expect(startOfWeek("2026-07-08")).toBe("2026-07-05");
    expect(startOfWeek("2026-07-05")).toBe("2026-07-05"); // already Sunday
  });
});

describe("computeOccurrences", () => {
  it("materializes weekly Tuesdays and keeps 4 PM local across spring-forward", () => {
    const occ = computeOccurrences(baseSlot, "2026-03-01", "2026-03-31", CHICAGO);

    expect(occ.map((o) => o.lesson_date)).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
      "2026-03-24",
      "2026-03-31",
    ]);
    // Before DST (CST): 16:00 local = 22:00Z. After March 8 (CDT): 21:00Z.
    expect(occ[0].starts_at).toBe("2026-03-03T22:00:00.000Z");
    expect(occ[1].starts_at).toBe("2026-03-10T21:00:00.000Z");
    expect(occ[4].starts_at).toBe("2026-03-31T21:00:00.000Z");
  });

  it("keeps 4 PM local across fall-back", () => {
    const occ = computeOccurrences(baseSlot, "2026-10-25", "2026-11-07", CHICAGO);
    expect(occ.map((o) => [o.lesson_date, o.starts_at])).toEqual([
      ["2026-10-27", "2026-10-27T21:00:00.000Z"], // CDT
      ["2026-11-03", "2026-11-03T22:00:00.000Z"], // CST
    ]);
  });

  it("materializes same-day when the range starts on the slot's weekday", () => {
    // Regression: a Tuesday slot queried from a Tuesday must include that
    // Tuesday (the CURRENT_DATE-is-already-tomorrow bug, Phase 2.5).
    const occ = computeOccurrences(baseSlot, "2026-07-07", "2026-07-07", CHICAGO);
    expect(occ).toHaveLength(1);
    expect(occ[0].lesson_date).toBe("2026-07-07");
  });

  it("returns nothing for inactive slots", () => {
    expect(
      computeOccurrences({ ...baseSlot, active: false }, "2026-07-01", "2026-07-31", CHICAGO)
    ).toHaveLength(0);
  });

  it("clamps to the slot's start_date and end_date", () => {
    const slot = { ...baseSlot, start_date: "2026-07-08", end_date: "2026-07-21" };
    const occ = computeOccurrences(slot, "2026-07-01", "2026-07-31", CHICAGO);
    // Tuesdays in July: 7, 14, 21, 28 — clamp excludes the 7th and 28th.
    expect(occ.map((o) => o.lesson_date)).toEqual(["2026-07-14", "2026-07-21"]);
  });

  it("returns nothing when the clamped range is empty", () => {
    const slot = { ...baseSlot, end_date: "2026-06-30" };
    expect(computeOccurrences(slot, "2026-07-01", "2026-07-31", CHICAGO)).toHaveLength(0);
  });

  it("carries slot metadata onto every occurrence", () => {
    const [occ] = computeOccurrences(baseSlot, "2026-07-07", "2026-07-07", CHICAGO);
    expect(occ).toMatchObject({
      teacher_id: "t-1",
      student_id: "s-1",
      slot_id: "slot-1",
      duration_minutes: 30,
    });
  });
});

describe("earnsMakeupCredit", () => {
  const lessonStart = "2026-07-14T21:00:00.000Z"; // Tue 4 PM CDT

  it("attended never earns a credit", () => {
    expect(earnsMakeupCredit("attended", null, lessonStart, DEFAULT_POLICY)).toBe(false);
  });

  it("teacher_cancel and no_show follow their policy flags", () => {
    expect(earnsMakeupCredit("teacher_cancel", null, lessonStart, DEFAULT_POLICY)).toBe(true);
    expect(earnsMakeupCredit("no_show", null, lessonStart, DEFAULT_POLICY)).toBe(false);
    expect(
      earnsMakeupCredit("no_show", null, lessonStart, {
        ...DEFAULT_POLICY,
        no_show_earns_makeup: true,
      })
    ).toBe(true);
  });

  it("student_cancel with notice outside the window is timely", () => {
    const twoDaysBefore = "2026-07-12T21:00:00.000Z";
    expect(earnsMakeupCredit("student_cancel", twoDaysBefore, lessonStart, DEFAULT_POLICY)).toBe(
      true
    );
  });

  it("student_cancel inside the window is late", () => {
    const twoHoursBefore = "2026-07-14T19:00:00.000Z";
    expect(earnsMakeupCredit("student_cancel", twoHoursBefore, lessonStart, DEFAULT_POLICY)).toBe(
      false
    );
    expect(
      earnsMakeupCredit("student_cancel", twoHoursBefore, lessonStart, {
        ...DEFAULT_POLICY,
        late_cancel_earns_makeup: true,
      })
    ).toBe(true);
  });

  it("notice exactly at the window boundary counts as timely", () => {
    const exactly24hBefore = "2026-07-13T21:00:00.000Z";
    expect(
      earnsMakeupCredit("student_cancel", exactly24hBefore, lessonStart, DEFAULT_POLICY)
    ).toBe(true);
  });
});

describe("creditIsValid", () => {
  it("never expires when expiry is null", () => {
    expect(creditIsValid("2000-01-01T00:00:00Z", DEFAULT_POLICY)).toBe(true);
  });

  it("expires after the configured number of days", () => {
    const policy = { ...DEFAULT_POLICY, makeup_credit_expiry_days: 30 };
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    expect(creditIsValid(tenDaysAgo, policy)).toBe(true);
    expect(creditIsValid(fortyDaysAgo, policy)).toBe(false);
  });
});

describe("display formatting", () => {
  // These strings render on both server and client; they must be stable
  // (regular spaces, en-US shapes) or React hydration breaks.
  it("formats lesson time in the studio timezone", () => {
    expect(formatLessonTime("2026-07-07T21:00:00.000Z", CHICAGO)).toBe("4:00 PM");
    expect(formatLessonTime("2026-01-13T22:00:00.000Z", CHICAGO)).toBe("4:00 PM");
  });

  it("formats lesson dates short and long", () => {
    expect(formatLessonDate("2026-07-07T21:00:00.000Z", CHICAGO)).toBe("Tue, Jul 7");
    expect(formatLessonDate("2026-07-07T21:00:00.000Z", CHICAGO, "long")).toBe(
      "Tuesday, July 7"
    );
  });
});

describe("oneToOne", () => {
  it("normalizes PostgREST embeds", () => {
    expect(oneToOne({ status: "attended" })).toEqual({ status: "attended" });
    expect(oneToOne([{ status: "attended" }])).toEqual({ status: "attended" });
    expect(oneToOne([])).toBeNull();
    expect(oneToOne(null)).toBeNull();
    expect(oneToOne(undefined)).toBeNull();
  });
});
