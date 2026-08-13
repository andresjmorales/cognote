import { describe, it, expect } from "vitest";
import {
  isUniqueViolation,
  ONBOARDING_TOUR_STEPS,
  parseStoredTourState,
  pathWithoutTourQuery,
  searchHasTourQuery,
  shouldProvisionTeacherFromSignup,
  signupEmailRedirectTo,
  stringFromUserMetadata,
  WELCOME_NOTIFICATION,
} from "@/lib/onboarding";

describe("signupEmailRedirectTo", () => {
  it("lands confirmation links on /auth/confirm", () => {
    expect(signupEmailRedirectTo("https://cognote.studio")).toBe(
      "https://cognote.studio/auth/confirm?next=/dashboard"
    );
    expect(signupEmailRedirectTo("https://cognote.studio/")).toBe(
      "https://cognote.studio/auth/confirm?next=/dashboard"
    );
  });
});

describe("shouldProvisionTeacherFromSignup", () => {
  it("is false for missing users", () => {
    expect(shouldProvisionTeacherFromSignup(null)).toBe(false);
    expect(shouldProvisionTeacherFromSignup(undefined)).toBe(false);
  });

  it("is false when identities is empty (duplicate-email dummy user)", () => {
    expect(shouldProvisionTeacherFromSignup({ identities: [] })).toBe(false);
    expect(shouldProvisionTeacherFromSignup({ identities: null })).toBe(false);
  });

  it("is true when the user has an identity", () => {
    expect(
      shouldProvisionTeacherFromSignup({
        identities: [{ id: "email" }],
      })
    ).toBe(true);
  });
});

describe("isUniqueViolation", () => {
  it("detects Postgres 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("stringFromUserMetadata", () => {
  it("reads trimmed strings and ignores junk", () => {
    expect(stringFromUserMetadata({ timezone: "America/Chicago" }, "timezone")).toBe(
      "America/Chicago"
    );
    expect(stringFromUserMetadata({ timezone: "  " }, "timezone")).toBe(null);
    expect(stringFromUserMetadata(null, "timezone")).toBe(null);
  });
});

describe("welcome notification", () => {
  it("uses the expected title and type", () => {
    expect(WELCOME_NOTIFICATION.type).toBe("welcome");
    expect(WELCOME_NOTIFICATION.title).toBe("Welcome to CogNote!");
    expect(WELCOME_NOTIFICATION.href).toBe("/help");
    expect(WELCOME_NOTIFICATION.body.length).toBeGreaterThan(20);
  });
});

describe("onboarding tour steps", () => {
  it("covers the main modules without duplicate ids", () => {
    const ids = ONBOARDING_TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "welcome",
      "students",
      "families",
      "schedule",
      "lessons",
      "billing",
      "account",
    ]);
  });

  it("stays short and avoids em dashes", () => {
    for (const step of ONBOARDING_TOUR_STEPS) {
      expect(step.title.length).toBeLessThan(40);
      expect(step.body).not.toMatch(/—/);
      expect(step.body).not.toMatch(/\b(delve|testament|tapestry|moreover)\b/i);
    }
  });

  it("points each step at a unique teacher route", () => {
    const hrefs = ONBOARDING_TOUR_STEPS.map((s) => s.href);
    expect(hrefs.every(Boolean)).toBe(true);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("tour query and stored state", () => {
  it("detects and strips the tour query without dropping other params", () => {
    expect(searchHasTourQuery("?tour=1")).toBe(true);
    expect(searchHasTourQuery("tour=1")).toBe(true);
    expect(searchHasTourQuery("?week=2026-08-10&tour=1")).toBe(true);
    expect(searchHasTourQuery("?tour=0")).toBe(false);
    expect(searchHasTourQuery("")).toBe(false);
    expect(pathWithoutTourQuery("/dashboard", "?tour=1")).toBe("/dashboard");
    expect(pathWithoutTourQuery("/schedule", "?week=2026-08-10&tour=1")).toBe(
      "/schedule?week=2026-08-10"
    );
  });

  it("restores a valid in-progress tour and rejects junk", () => {
    expect(parseStoredTourState(null)).toBe(null);
    expect(parseStoredTourState("{")).toBe(null);
    expect(parseStoredTourState(JSON.stringify({ active: false, stepIndex: 1 }))).toBe(
      null
    );
    expect(parseStoredTourState(JSON.stringify({ active: true, stepIndex: 99 }))).toBe(
      null
    );
    expect(
      parseStoredTourState(
        JSON.stringify({ active: true, stepIndex: 2, restart: true })
      )
    ).toEqual({ active: true, stepIndex: 2, restart: true });
  });
});
