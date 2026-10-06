import { describe, it, expect } from "vitest";
import {
  localTimeInput,
  planLessonMove,
  rescheduleSkipKeys,
  findMoveConflicts,
  type MovableLesson,
} from "@/lib/reschedule";

const CHICAGO = "America/Chicago";

const slotLesson: MovableLesson = {
  slot_id: "slot-1",
  lesson_date: "2026-07-07",
  starts_at: "2026-07-07T21:00:00.000Z",
  duration_minutes: 30,
  rescheduled_from_date: null,
};

describe("localTimeInput", () => {
  it("renders the wall-clock time in the studio zone as HH:mm", () => {
    expect(localTimeInput("2026-07-07T21:00:00.000Z", CHICAGO)).toBe("16:00");
    expect(localTimeInput("2026-01-13T22:00:00.000Z", CHICAGO)).toBe("16:00");
  });
});

describe("planLessonMove", () => {
  it("moves a slot lesson to a new date, preserving local time and recording the origin", () => {
    const plan = planLessonMove({ date: "2026-07-09" }, slotLesson, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.dateChanged).toBe(true);
    expect(plan.patch.lesson_date).toBe("2026-07-09");
    expect(plan.patch.starts_at).toBe("2026-07-09T21:00:00.000Z");
    expect(plan.patch.rescheduled_from_date).toBe("2026-07-07");
  });

  it("applies a same-day time change with no vacated occurrence", () => {
    const plan = planLessonMove({ time: "15:00" }, slotLesson, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.dateChanged).toBe(false);
    expect(plan.patch.starts_at).toBe("2026-07-07T20:00:00.000Z");
    expect("rescheduled_from_date" in plan.patch).toBe(false);
    expect("lesson_date" in plan.patch).toBe(false);
  });

  it("changes only the duration without touching the date or instant", () => {
    const plan = planLessonMove({ durationMinutes: 45 }, slotLesson, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.duration_minutes).toBe(45);
    expect("starts_at" in plan.patch).toBe(false);
    expect("rescheduled_from_date" in plan.patch).toBe(false);
  });

  it("does not record an origin for an ad-hoc lesson", () => {
    const adHoc: MovableLesson = { ...slotLesson, slot_id: null };
    const plan = planLessonMove({ date: "2026-07-09" }, adHoc, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect("rescheduled_from_date" in plan.patch).toBe(false);
  });

  it("preserves the original origin across a repeat move", () => {
    const moved: MovableLesson = {
      ...slotLesson,
      lesson_date: "2026-07-09",
      starts_at: "2026-07-09T21:00:00.000Z",
      rescheduled_from_date: "2026-07-07",
    };
    const plan = planLessonMove({ date: "2026-07-10" }, moved, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.rescheduled_from_date).toBe("2026-07-07");
  });

  it("clears the origin when moved back onto it", () => {
    const moved: MovableLesson = {
      ...slotLesson,
      lesson_date: "2026-07-09",
      starts_at: "2026-07-09T21:00:00.000Z",
      rescheduled_from_date: "2026-07-07",
    };
    const plan = planLessonMove({ date: "2026-07-07" }, moved, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.rescheduled_from_date).toBeNull();
  });

  it("rejects bad input", () => {
    expect(planLessonMove({ date: "07/09/2026" }, slotLesson, CHICAGO).ok).toBe(false);
    expect(planLessonMove({ time: "4pm" }, slotLesson, CHICAGO).ok).toBe(false);
    expect(planLessonMove({ durationMinutes: 0 }, slotLesson, CHICAGO).ok).toBe(false);
    expect(planLessonMove({ durationMinutes: 30.5 }, slotLesson, CHICAGO).ok).toBe(false);
  });
});

describe("rescheduleSkipKeys", () => {
  it("keys only real (slot, origin) pairs", () => {
    const keys = rescheduleSkipKeys([
      { slot_id: "slot-1", rescheduled_from_date: "2026-07-07" },
      { slot_id: null, rescheduled_from_date: "2026-07-08" },
      { slot_id: "slot-2", rescheduled_from_date: null },
    ]);
    expect([...keys]).toEqual(["slot-1|2026-07-07"]);
  });
});

describe("findMoveConflicts", () => {
  const other = (studentId: string, startsAt: string, durationMinutes: number) => ({
    studentId,
    startsAt,
    durationMinutes,
  });

  it("flags a teacher and student overlap independently", () => {
    const target = other("s-1", "2026-07-07T21:00:00.000Z", 30);
    expect(findMoveConflicts(target, [other("s-1", "2026-07-07T21:15:00.000Z", 30)]))
      .toEqual({ studentOverlap: true, teacherOverlap: true });
    expect(findMoveConflicts(target, [other("s-2", "2026-07-07T21:15:00.000Z", 30)]))
      .toEqual({ studentOverlap: false, teacherOverlap: true });
  });

  it("treats exactly-touching intervals as no overlap", () => {
    const target = other("s-1", "2026-07-07T21:00:00.000Z", 30);
    expect(findMoveConflicts(target, [other("s-1", "2026-07-07T21:30:00.000Z", 30)]))
      .toEqual({ studentOverlap: false, teacherOverlap: false });
  });

  it("returns clean when nothing overlaps", () => {
    const target = other("s-1", "2026-07-07T21:00:00.000Z", 30);
    expect(findMoveConflicts(target, [other("s-2", "2026-07-08T21:00:00.000Z", 30)]))
      .toEqual({ studentOverlap: false, teacherOverlap: false });
  });
});

describe("move edge cases", () => {
  const interval = (
    studentId: string,
    startsAt: string,
    durationMinutes: number
  ) => ({ studentId, startsAt, durationMinutes });

  it("recomputes the instant across a DST boundary", () => {
    // 2026-03-05 is CST (UTC-6); 2026-03-12 is CDT (UTC-5) after spring-forward.
    const beforeDst: MovableLesson = {
      ...slotLesson,
      lesson_date: "2026-03-05",
      starts_at: "2026-03-05T22:00:00.000Z",
    };
    const plan = planLessonMove({ date: "2026-03-12" }, beforeDst, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.starts_at).toBe("2026-03-12T21:00:00.000Z");
    expect(plan.patch.rescheduled_from_date).toBe("2026-03-05");
  });

  it("writes no origin when the date is unchanged", () => {
    const plan = planLessonMove(
      { date: slotLesson.lesson_date },
      slotLesson,
      CHICAGO
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.dateChanged).toBe(false);
    expect("rescheduled_from_date" in plan.patch).toBe(false);
  });

  it("keeps a previously-moved lesson's origin on a same-day time tweak", () => {
    const moved: MovableLesson = {
      ...slotLesson,
      lesson_date: "2026-07-09",
      starts_at: "2026-07-09T21:00:00.000Z",
      rescheduled_from_date: "2026-07-07",
    };
    const plan = planLessonMove({ time: "15:00" }, moved, CHICAGO);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.starts_at).toBe("2026-07-09T20:00:00.000Z");
    expect("rescheduled_from_date" in plan.patch).toBe(false);
    expect("lesson_date" in plan.patch).toBe(false);
  });

  it("returns an empty skip set for no rows", () => {
    expect([...rescheduleSkipKeys([])]).toEqual([]);
  });

  it("detects a move that fully contains another lesson", () => {
    const target = interval("s-1", "2026-07-07T21:00:00.000Z", 60); // 21:00-22:00
    const inner = interval("s-1", "2026-07-07T21:15:00.000Z", 15); // inside it
    expect(findMoveConflicts(target, [inner])).toEqual({
      studentOverlap: true,
      teacherOverlap: true,
    });
  });
});
