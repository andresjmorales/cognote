import { describe, it, expect } from "vitest";
import type { EventAttributes } from "ics";
import { lessonEvent, studioEvent, buildIcs, icsFilename } from "@/lib/calendar-feed";

// `EventAttributes` is a union (duration-based vs end-based), so `duration`
// is not directly readable on it; narrow to the variant that carries it.
function durationMinutes(e: EventAttributes): number | undefined {
  return "duration" in e ? e.duration?.minutes : undefined;
}

describe("lessonEvent", () => {
  it("uses a stable per-lesson UID and a student-labelled summary", () => {
    const e = lessonEvent(
      {
        id: "abc",
        starts_at: "2026-07-14T06:00:00.000Z",
        duration_minutes: 30,
        studentName: "Ann",
      },
      "Piano Lessons"
    );
    expect(e.uid).toBe("abc@cognote.studio");
    expect(e.title).toBe("Piano lesson — Ann");
    expect(durationMinutes(e)).toBe(30);
    expect(e.start).toEqual([2026, 7, 14, 6, 0]);
  });
});

describe("studioEvent", () => {
  it("derives duration from ends_at when present", () => {
    const e = studioEvent(
      {
        id: "ev1",
        title: "Recital",
        location: "Hall",
        starts_at: "2026-07-14T09:00:00.000Z",
        ends_at: "2026-07-14T10:30:00.000Z",
      },
      "CogNote"
    );
    expect(e.uid).toBe("ev1@cognote.studio");
    expect(durationMinutes(e)).toBe(90);
    expect(e.location).toBe("Hall");
  });

  it("falls back to 60 minutes when ends_at is null or out of order", () => {
    const base = {
      id: "ev2",
      title: "Recital",
      location: null,
      starts_at: "2026-07-14T09:00:00.000Z",
    };
    expect(durationMinutes(studioEvent({ ...base, ends_at: null }, "CogNote"))).toBe(60);
    expect(
      durationMinutes(
        studioEvent({ ...base, ends_at: "2026-07-14T08:00:00.000Z" }, "CogNote")
      )
    ).toBe(60);
    expect(studioEvent({ ...base, ends_at: null }, "CogNote").location).toBeUndefined();
  });
});

describe("buildIcs", () => {
  it("emits a valid empty calendar when there are no events", () => {
    expect(buildIcs([])).toContain("BEGIN:VCALENDAR");
  });

  it("emits UID and SUMMARY lines for an event", () => {
    const ics = buildIcs([
      lessonEvent(
        {
          id: "abc",
          starts_at: "2026-07-14T06:00:00.000Z",
          duration_minutes: 30,
          studentName: "Ann",
        },
        "Piano Lessons"
      ),
    ])!;
    expect(ics).toContain("UID:abc@cognote.studio");
    expect(ics).toContain("SUMMARY:Piano lesson — Ann");
    expect(ics).toContain("DURATION:PT30M");
  });
});

describe("icsFilename", () => {
  it("slugifies the owner name", () => {
    expect(icsFilename("The Lee Family")).toBe("lessons-the-lee-family.ics");
    expect(icsFilename("Ms Lim", "schedule")).toBe("schedule-ms-lim.ics");
  });
});
