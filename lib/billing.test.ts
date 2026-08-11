import { describe, it, expect } from "vitest";
import {
  resolveLessonRate,
  resolveLessonCharge,
  resolveTravelFeeCents,
  isBillable,
  deriveInvoiceItems,
  lessonAmountCents,
  groupItemsByGuardian,
  sumAmountCents,
  formatMoney,
  dollarsToCents,
  centsToDollarsInput,
  defaultInvoicePeriod,
  maskSecret,
  validateLiveStripeKeys,
  type BillableLessonInput,
} from "@/lib/billing";
import { DEFAULT_POLICY, type StudioPolicy } from "@/lib/schedule";

const baseLesson: BillableLessonInput = {
  lessonId: "lesson-1",
  studentId: "s-1",
  studentName: "Gloria",
  guardianId: "g-1",
  lessonDate: "2026-06-15",
  startsAt: "2026-06-15T21:00:00.000Z", // 4 PM CDT
  durationMinutes: 30,
  makeupFor: null,
  attendanceStatus: "attended",
  noticeAt: null,
  rate: {
    slotRateCents: null,
    studentDefaultRateCents: null,
    studioDefaultRateCents: 4000,
  },
};

describe("resolveLessonRate", () => {
  it("prefers slot over student over studio", () => {
    expect(
      resolveLessonRate({
        slotRateCents: 5500,
        studentDefaultRateCents: 4500,
        studioDefaultRateCents: 4000,
      })
    ).toBe(5500);
    expect(
      resolveLessonRate({
        slotRateCents: null,
        studentDefaultRateCents: 4500,
        studioDefaultRateCents: 4000,
      })
    ).toBe(4500);
    expect(
      resolveLessonRate({
        slotRateCents: null,
        studentDefaultRateCents: null,
        studioDefaultRateCents: 4000,
      })
    ).toBe(4000);
  });

  it("returns null when nothing is set", () => {
    expect(
      resolveLessonRate({
        slotRateCents: null,
        studentDefaultRateCents: null,
        studioDefaultRateCents: null,
      })
    ).toBeNull();
  });

  it("treats zero as a valid rate", () => {
    expect(
      resolveLessonRate({
        slotRateCents: 0,
        studentDefaultRateCents: 4000,
        studioDefaultRateCents: 4000,
      })
    ).toBe(0);
  });
});

describe("isBillable", () => {
  it("follows attended / no_show / teacher_cancel flags", () => {
    expect(isBillable({ ...baseLesson, attendanceStatus: "attended" }, DEFAULT_POLICY)).toBe(
      true
    );
    expect(isBillable({ ...baseLesson, attendanceStatus: "no_show" }, DEFAULT_POLICY)).toBe(
      true
    );
    expect(
      isBillable({ ...baseLesson, attendanceStatus: "teacher_cancel" }, DEFAULT_POLICY)
    ).toBe(false);
  });

  it("distinguishes timely vs late student cancellations", () => {
    const timely = {
      ...baseLesson,
      attendanceStatus: "student_cancel" as const,
      noticeAt: "2026-06-13T21:00:00.000Z", // 48h before
    };
    const late = {
      ...baseLesson,
      attendanceStatus: "student_cancel" as const,
      noticeAt: "2026-06-15T19:00:00.000Z", // 2h before
    };
    expect(isBillable(timely, DEFAULT_POLICY)).toBe(false);
    expect(isBillable(late, DEFAULT_POLICY)).toBe(true);
  });

  it("skips make-up lessons when bill_makeup is false", () => {
    expect(
      isBillable(
        { ...baseLesson, makeupFor: "att-1", attendanceStatus: "attended" },
        DEFAULT_POLICY
      )
    ).toBe(false);
    const policy: StudioPolicy = { ...DEFAULT_POLICY, bill_makeup: true };
    expect(
      isBillable(
        { ...baseLesson, makeupFor: "att-1", attendanceStatus: "attended" },
        policy
      )
    ).toBe(true);
  });
});

describe("lessonAmountCents", () => {
  it("charges the full rate per lesson", () => {
    expect(lessonAmountCents(4500, 30, "per_lesson")).toBe(4500);
    expect(lessonAmountCents(4500, 45, "per_lesson")).toBe(4500);
  });

  it("scales hourly rates by duration", () => {
    expect(lessonAmountCents(4500, 60, "per_hour")).toBe(4500);
    expect(lessonAmountCents(4500, 30, "per_hour")).toBe(2250);
    expect(lessonAmountCents(4500, 45, "per_hour")).toBe(3375);
  });
});

describe("resolveLessonCharge", () => {
  it("uses duration flat rates when no slot rate is set", () => {
    const charge = resolveLessonCharge(
      {
        slotRateCents: null,
        studentDefaultRateCents: null,
        studioDefaultRateCents: 6000,
        durationRateCents: 4000,
      },
      30,
      "per_hour"
    );
    expect(charge).toMatchObject({
      amountCents: 4000,
      missingRate: false,
      usedDurationFlat: true,
    });
  });

  it("prefers slot rate over duration flat", () => {
    const charge = resolveLessonCharge(
      {
        slotRateCents: 8000,
        studentDefaultRateCents: null,
        studioDefaultRateCents: 6000,
        durationRateCents: 4000,
      },
      30,
      "per_hour"
    );
    expect(charge.amountCents).toBe(4000); // $80/hr × 30 min
    expect(charge.usedDurationFlat).toBe(false);
  });
});

describe("resolveTravelFeeCents", () => {
  it("prefers student override over studio default", () => {
    expect(
      resolveTravelFeeCents({
        studentTravelFeeCents: 700,
        studioTravelFeeCents: 500,
      })
    ).toBe(700);
    expect(
      resolveTravelFeeCents({
        studentTravelFeeCents: null,
        studioTravelFeeCents: 500,
      })
    ).toBe(500);
    expect(
      resolveTravelFeeCents({
        studentTravelFeeCents: 0,
        studioTravelFeeCents: 500,
      })
    ).toBe(0);
  });
});

describe("deriveInvoiceItems", () => {
  it("creates one line per billable lesson with a rate", () => {
    const policy: StudioPolicy = {
      ...DEFAULT_POLICY,
      rate_basis: "per_lesson",
    };
    const items = deriveInvoiceItems([baseLesson], policy);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      guardianId: "g-1",
      unitCents: 4000,
      amountCents: 4000,
      missingRate: false,
    });
    expect(items[0].description).toContain("Gloria");
    expect(items[0].description).toContain("30 min");
  });

  it("scales amounts when rate_basis is per_hour", () => {
    const policy: StudioPolicy = { ...DEFAULT_POLICY, rate_basis: "per_hour" };
    const items = deriveInvoiceItems(
      [
        baseLesson, // 30 min @ $40/hr
        {
          ...baseLesson,
          lessonId: "l2",
          durationMinutes: 45,
        },
      ],
      policy
    );
    expect(items[0].amountCents).toBe(2000);
    expect(items[1].amountCents).toBe(3000);
    expect(items[0].description).toContain("/hr");
  });

  it("uses duration flat map instead of hourly default", () => {
    const policy: StudioPolicy = {
      ...DEFAULT_POLICY,
      rate_basis: "per_hour",
      default_rate_cents: 6000,
      duration_rate_cents: { 30: 4000, 45: 6000 },
    };
    const items = deriveInvoiceItems(
      [
        baseLesson,
        { ...baseLesson, lessonId: "l2", durationMinutes: 45 },
      ],
      policy
    );
    expect(items[0].amountCents).toBe(4000);
    expect(items[1].amountCents).toBe(6000);
    expect(items[0].description).not.toContain("/hr");
  });

  it("adds a travel fee line for home visits", () => {
    const policy: StudioPolicy = {
      ...DEFAULT_POLICY,
      rate_basis: "per_hour",
      travel_fee_cents: 500,
    };
    const items = deriveInvoiceItems(
      [
        {
          ...baseLesson,
          isHomeVisit: true,
          travel: {
            studentTravelFeeCents: null,
            studioTravelFeeCents: 500,
          },
        },
      ],
      policy
    );
    expect(items).toHaveLength(2);
    expect(items[0].amountCents).toBe(2000);
    expect(items[1]).toMatchObject({
      description: expect.stringContaining("Travel fee"),
      amountCents: 500,
      missingRate: false,
    });
  });

  it("skips travel fee when not a home visit or fee is zero", () => {
    const items = deriveInvoiceItems(
      [
        {
          ...baseLesson,
          isHomeVisit: false,
          travel: {
            studentTravelFeeCents: null,
            studioTravelFeeCents: 500,
          },
        },
        {
          ...baseLesson,
          lessonId: "l2",
          isHomeVisit: true,
          travel: {
            studentTravelFeeCents: 0,
            studioTravelFeeCents: 500,
          },
        },
      ],
      { ...DEFAULT_POLICY, rate_basis: "per_hour" }
    );
    expect(items).toHaveLength(2);
    expect(items.every((i) => !i.description.includes("Travel fee"))).toBe(true);
  });

  it("flags missing rates but still emits a $0 line", () => {
    const items = deriveInvoiceItems(
      [
        {
          ...baseLesson,
          rate: {
            slotRateCents: null,
            studentDefaultRateCents: null,
            studioDefaultRateCents: null,
          },
        },
      ],
      DEFAULT_POLICY
    );
    expect(items).toHaveLength(1);
    expect(items[0].missingRate).toBe(true);
    expect(items[0].amountCents).toBe(0);
  });

  it("skips non-billable and guardian-less lessons", () => {
    const items = deriveInvoiceItems(
      [
        { ...baseLesson, attendanceStatus: "teacher_cancel" },
        { ...baseLesson, lessonId: "l2", guardianId: null },
      ],
      DEFAULT_POLICY
    );
    expect(items).toHaveLength(0);
  });

  it("groups by guardian and sums totals", () => {
    const policy: StudioPolicy = {
      ...DEFAULT_POLICY,
      rate_basis: "per_lesson",
    };
    const items = deriveInvoiceItems(
      [
        baseLesson,
        {
          ...baseLesson,
          lessonId: "l2",
          studentId: "s-2",
          studentName: "Nico",
          guardianId: "g-1",
        },
        {
          ...baseLesson,
          lessonId: "l3",
          studentId: "s-3",
          studentName: "Stella",
          guardianId: "g-2",
          rate: {
            slotRateCents: 5000,
            studentDefaultRateCents: null,
            studioDefaultRateCents: null,
          },
        },
      ],
      policy
    );
    const groups = groupItemsByGuardian(items);
    expect(groups.size).toBe(2);
    expect(sumAmountCents(groups.get("g-1")!)).toBe(8000);
    expect(sumAmountCents(groups.get("g-2")!)).toBe(5000);
  });
});

describe("money helpers", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(4500, "USD")).toBe("$45.00");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("parses dollars to cents", () => {
    expect(dollarsToCents("45")).toBe(4500);
    expect(dollarsToCents("45.50")).toBe(4550);
    expect(dollarsToCents("$40")).toBe(4000);
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
  });

  it("round-trips cents to dollars input", () => {
    expect(centsToDollarsInput(4500)).toBe("45.00");
    expect(centsToDollarsInput(null)).toBe("");
  });
});

describe("defaultInvoicePeriod", () => {
  it("returns the previous calendar month for monthly cadence", () => {
    expect(defaultInvoicePeriod("2026-07-10", "monthly")).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
    expect(defaultInvoicePeriod("2026-01-05", "monthly")).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("returns month-to-date for manual cadence", () => {
    expect(defaultInvoicePeriod("2026-07-10", "manual")).toEqual({
      start: "2026-07-01",
      end: "2026-07-10",
    });
  });
});

describe("maskSecret", () => {
  // Build fake keys at runtime so GitHub push protection does not treat
  // literal sk_live_… strings in source as secrets.
  const fakeLiveSecret = ["sk", "live", "abcdefghijklmnopqrstuvwxyz"].join("_");

  it("masks long secrets", () => {
    expect(maskSecret(fakeLiveSecret)).toBe("sk_live…wxyz");
  });

  it("handles empty", () => {
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret("short")).toBe("••••••••");
  });
});

describe("validateLiveStripeKeys", () => {
  const liveSecret = ["sk", "live", "abc"].join("_");
  const livePublishable = ["pk", "live", "xyz"].join("_");
  const testSecret = ["sk", "test", "abc"].join("_");
  const testPublishable = ["pk", "test", "xyz"].join("_");
  const restrictedSecret = ["rk", "live", "abc"].join("_");

  it("accepts live keys and empty values", () => {
    expect(
      validateLiveStripeKeys({
        secretKey: liveSecret,
        publishableKey: livePublishable,
      })
    ).toBeNull();
    expect(validateLiveStripeKeys({})).toBeNull();
    expect(
      validateLiveStripeKeys({ secretKey: null, publishableKey: "" })
    ).toBeNull();
  });

  it("rejects test keys", () => {
    expect(validateLiveStripeKeys({ secretKey: testSecret })).toMatch(
      /Test\/sandbox/
    );
    expect(
      validateLiveStripeKeys({ publishableKey: testPublishable })
    ).toMatch(/Test\/sandbox/);
  });

  it("rejects restricted keys", () => {
    expect(validateLiveStripeKeys({ secretKey: restrictedSecret })).toMatch(
      /Restricted/
    );
  });

  it("rejects keys that are not live-prefixed", () => {
    expect(validateLiveStripeKeys({ secretKey: "not_a_key" })).toMatch(
      /sk_live_/
    );
    expect(validateLiveStripeKeys({ publishableKey: "pk_abc" })).toMatch(
      /pk_live_/
    );
  });
});
