import { describe, it, expect } from "vitest";
import {
  allocateCredits,
  describeCreditPackage,
  packageCoversLesson,
  summarizeCreditBalances,
  validateCreditPackage,
  type CreditCandidate,
  type CreditPackageInput,
} from "@/lib/credits";

const pkg: CreditPackageInput = {
  id: "p1",
  studentId: "s1",
  durationMinutes: 30,
  credits: 3,
  usedCredits: 0,
  startsOn: "2026-10-01",
  expiresOn: null,
  active: true,
};

function lesson(
  id: string,
  date: string,
  overrides: Partial<CreditCandidate> = {}
): CreditCandidate {
  return {
    lessonId: id,
    studentId: "s1",
    lessonDate: date,
    startsAt: `${date}T21:00:00.000Z`,
    durationMinutes: 30,
    ...overrides,
  };
}

describe("packageCoversLesson", () => {
  it("matches student, length and dates", () => {
    expect(packageCoversLesson(pkg, lesson("l1", "2026-10-05"))).toBe(true);
    expect(
      packageCoversLesson(pkg, lesson("l1", "2026-10-05", { studentId: "s2" }))
    ).toBe(false);
    expect(
      packageCoversLesson(pkg, lesson("l1", "2026-10-05", { durationMinutes: 45 }))
    ).toBe(false);
    expect(packageCoversLesson(pkg, lesson("l1", "2026-09-30"))).toBe(false);
  });

  it("treats the expiry date as inclusive", () => {
    const expiring = { ...pkg, expiresOn: "2026-10-31" };
    expect(packageCoversLesson(expiring, lesson("l1", "2026-10-31"))).toBe(true);
    expect(packageCoversLesson(expiring, lesson("l1", "2026-11-01"))).toBe(false);
  });

  it("ignores packages whose invoice isn't sent yet", () => {
    expect(
      packageCoversLesson({ ...pkg, active: false }, lesson("l1", "2026-10-05"))
    ).toBe(false);
  });
});

describe("allocateCredits", () => {
  it("covers lessons oldest first until credits run out", () => {
    const allocation = allocateCredits(
      [
        lesson("l4", "2026-10-26"),
        lesson("l1", "2026-10-05"),
        lesson("l3", "2026-10-19"),
        lesson("l2", "2026-10-12"),
      ],
      [pkg]
    );
    expect([...allocation.keys()]).toEqual(["l1", "l2", "l3"]);
    expect(allocation.get("l4")).toBeUndefined();
  });

  it("counts credits already used", () => {
    const allocation = allocateCredits(
      [lesson("l1", "2026-10-05"), lesson("l2", "2026-10-12")],
      [{ ...pkg, usedCredits: 2 }]
    );
    expect([...allocation.keys()]).toEqual(["l1"]);
  });

  it("uses the package that expires soonest first", () => {
    const later = { ...pkg, id: "later", expiresOn: "2027-06-30" };
    const sooner = { ...pkg, id: "sooner", credits: 1, expiresOn: "2026-12-31" };
    const never = { ...pkg, id: "never" };
    const allocation = allocateCredits(
      [
        lesson("l1", "2026-10-05"),
        lesson("l2", "2026-10-12"),
        lesson("l3", "2026-10-19"),
      ],
      [never, later, sooner]
    );
    expect(allocation.get("l1")).toBe("sooner");
    expect(allocation.get("l2")).toBe("later");
    expect(allocation.get("l3")).toBe("later");
  });

  it("checks expiry against the lesson date, not when it's billed", () => {
    const expired = { ...pkg, expiresOn: "2026-10-10" };
    const allocation = allocateCredits(
      [lesson("l1", "2026-10-05"), lesson("l2", "2026-10-12")],
      [expired]
    );
    expect([...allocation.keys()]).toEqual(["l1"]);
  });

  it("only spends a package on its own lesson length", () => {
    const thirty = pkg;
    const fortyFive = { ...pkg, id: "p45", durationMinutes: 45, credits: 1 };
    const allocation = allocateCredits(
      [
        lesson("l1", "2026-10-05", { durationMinutes: 45 }),
        lesson("l2", "2026-10-12", { durationMinutes: 45 }),
        lesson("l3", "2026-10-19"),
      ],
      [thirty, fortyFive]
    );
    expect(allocation.get("l1")).toBe("p45");
    expect(allocation.get("l2")).toBeUndefined();
    expect(allocation.get("l3")).toBe("p1");
  });

  it("returns nothing without packages", () => {
    expect(allocateCredits([lesson("l1", "2026-10-05")], []).size).toBe(0);
  });
});

describe("summarizeCreditBalances", () => {
  it("counts pending lessons as spent", () => {
    const [balance] = summarizeCreditBalances(
      [{ ...pkg, usedCredits: 1 }],
      new Map([["l9", "p1"]]),
      "2026-10-19"
    );
    expect(balance).toMatchObject({
      usedCredits: 1,
      pendingCredits: 1,
      remainingCredits: 1,
      state: "active",
    });
  });

  it("labels pending, used-up and expired packages", () => {
    const balances = summarizeCreditBalances(
      [
        { ...pkg, id: "draft", active: false },
        { ...pkg, id: "full", usedCredits: 3 },
        { ...pkg, id: "old", expiresOn: "2026-10-18" },
        { ...pkg, id: "today", expiresOn: "2026-10-19" },
      ],
      new Map(),
      "2026-10-19"
    );
    expect(balances.map((b) => b.state)).toEqual([
      "pending",
      "used_up",
      "expired",
      "active",
    ]);
  });
});

describe("validateCreditPackage", () => {
  const ok = {
    credits: 10,
    durationMinutes: 30,
    priceCents: 40000,
    startsOn: "2026-10-19",
    expiresOn: null,
  };

  it("accepts a normal package", () => {
    expect(validateCreditPackage(ok)).toBeNull();
    expect(
      validateCreditPackage({ ...ok, priceCents: 0, expiresOn: "2026-10-19" })
    ).toBeNull();
  });

  it("rejects bad counts, lengths, prices and dates", () => {
    expect(validateCreditPackage({ ...ok, credits: 0 })).not.toBeNull();
    expect(validateCreditPackage({ ...ok, credits: 2.5 })).not.toBeNull();
    expect(validateCreditPackage({ ...ok, durationMinutes: 0 })).not.toBeNull();
    expect(validateCreditPackage({ ...ok, priceCents: -1 })).not.toBeNull();
    expect(
      validateCreditPackage({ ...ok, expiresOn: "2026-10-18" })
    ).not.toBeNull();
    expect(validateCreditPackage({ ...ok, startsOn: "soon" })).not.toBeNull();
  });
});

describe("describeCreditPackage", () => {
  it("pluralizes", () => {
    expect(describeCreditPackage(10, 30)).toBe("10 × 30-min lessons");
    expect(describeCreditPackage(1, 45)).toBe("1 × 45-min lesson");
  });
});
