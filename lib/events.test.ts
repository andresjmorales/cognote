import { describe, expect, it } from "vitest";
import {
  formatEventDateKey,
  isEventReminderDay,
  validateEventEndAfterStart,
} from "@/lib/events";

const CHICAGO = "America/Chicago";
const TOKYO = "Asia/Tokyo";

describe("formatEventDateKey", () => {
  it("uses the studio timezone, not UTC", () => {
    // 10 PM Chicago July 11 = 03:00 UTC July 12
    expect(formatEventDateKey("2026-07-12T03:00:00.000Z", CHICAGO)).toBe(
      "2026-07-11"
    );
  });
});

describe("isEventReminderDay", () => {
  it("is true on the studio-local day before the event", () => {
    // Event: Saturday July 12, 2026 at 3 PM Chicago (20:00 UTC)
    const startsAt = "2026-07-12T20:00:00.000Z";
    // Friday July 11, noon Chicago
    const fridayNoon = new Date("2026-07-11T17:00:00.000Z");
    expect(isEventReminderDay(startsAt, CHICAGO, fridayNoon)).toBe(true);
  });

  it("is false on the event day itself", () => {
    const startsAt = "2026-07-12T20:00:00.000Z";
    const saturdayMorning = new Date("2026-07-12T14:00:00.000Z");
    expect(isEventReminderDay(startsAt, CHICAGO, saturdayMorning)).toBe(false);
  });

  it("is false two days before", () => {
    const startsAt = "2026-07-12T20:00:00.000Z";
    const thursday = new Date("2026-07-10T17:00:00.000Z");
    expect(isEventReminderDay(startsAt, CHICAGO, thursday)).toBe(false);
  });

  it("respects timezone when UTC date differs from local date", () => {
    // 3 PM Chicago July 12 = 5 AM Tokyo July 13
    const startsAt = "2026-07-12T20:00:00.000Z";
    // Saturday morning Chicago (= Saturday evening Tokyo) is the event day
    // in Chicago, but still the day before in Tokyo.
    const saturdayChicagoMorning = new Date("2026-07-12T14:00:00.000Z");
    expect(isEventReminderDay(startsAt, CHICAGO, saturdayChicagoMorning)).toBe(
      false
    );
    expect(isEventReminderDay(startsAt, TOKYO, saturdayChicagoMorning)).toBe(
      true
    );
  });

  it("handles late-evening 'now' still on the reminder calendar day", () => {
    const startsAt = "2026-07-12T20:00:00.000Z";
    // Friday 11:30 PM Chicago = Saturday 04:30 UTC
    const lateFriday = new Date("2026-07-12T04:30:00.000Z");
    expect(isEventReminderDay(startsAt, CHICAGO, lateFriday)).toBe(true);
  });
});

describe("validateEventEndAfterStart", () => {
  it("allows missing end", () => {
    expect(validateEventEndAfterStart("2026-07-12T20:00:00.000Z", null)).toBe(
      null
    );
  });

  it("rejects end before or equal to start", () => {
    expect(
      validateEventEndAfterStart(
        "2026-07-12T20:00:00.000Z",
        "2026-07-12T19:00:00.000Z"
      )
    ).toMatch(/after/i);
  });
});
