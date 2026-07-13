import { describe, expect, it } from "vitest";
import {
  createdAtToPracticeStartDate,
  formatPracticeSince,
  isYearOnlyPracticeStart,
  yearToPracticeStartDate,
  yearsSincePracticeStart,
} from "@/lib/students-practice";
import { normalizePlanLabels } from "@/lib/plans";

describe("normalizePlanLabels", () => {
  it("trims, drops empties, and dedupes case-insensitively", () => {
    expect(
      normalizePlanLabels([" Easy ", "easy", "Fundamentals", "", "  "])
    ).toEqual(["Easy", "Fundamentals"]);
  });
});

describe("practice start helpers", () => {
  it("stores year-only as Jan 1", () => {
    expect(yearToPracticeStartDate(2021)).toBe("2021-01-01");
    expect(isYearOnlyPracticeStart("2021-01-01")).toBe(true);
    expect(isYearOnlyPracticeStart("2021-06-15")).toBe(false);
  });

  it("formats year-only and exact dates", () => {
    const now = new Date(2026, 6, 13);
    expect(formatPracticeSince("2021-01-01", now)).toContain("since 2021");
    expect(formatPracticeSince("2021-01-01", now)).toContain("~5 years");
    expect(yearsSincePracticeStart("2024-06-01", now)).toBe(2);
  });

  it("converts created_at to local YYYY-MM-DD", () => {
    const result = createdAtToPracticeStartDate("2026-03-15T18:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
