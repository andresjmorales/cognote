import { describe, it, expect } from "vitest";
import {
  evaluateLimit,
  formatHostedPrice,
  getDeploymentMode,
  hostedSignupFields,
  requiresBetaCode,
  resolveEffectivePlan,
  HOSTED_LIMIT_ERROR_CODE,
  type TeacherEntitlementRow,
} from "@/lib/entitlements";

const freeTeacher: TeacherEntitlementRow = {
  hosted_plan: "free",
  trial_ends_at: null,
  gifted_until: null,
};

describe("getDeploymentMode", () => {
  it("defaults to self_hosted", () => {
    expect(getDeploymentMode({})).toBe("self_hosted");
    expect(getDeploymentMode({ COGNOTE_DEPLOYMENT: "SELF_HOSTED" })).toBe(
      "self_hosted"
    );
  });

  it("recognizes hosted", () => {
    expect(getDeploymentMode({ COGNOTE_DEPLOYMENT: "hosted" })).toBe("hosted");
  });
});

describe("requiresBetaCode", () => {
  it("is off when nothing is set", () => {
    expect(requiresBetaCode({})).toBe(false);
  });

  it("falls back to BETA_ACCESS_CODE when BETA_ONLY unset", () => {
    expect(requiresBetaCode({ BETA_ACCESS_CODE: "secret" })).toBe(true);
  });

  it("lets NEXT_PUBLIC_BETA_ONLY override the code", () => {
    expect(
      requiresBetaCode({
        NEXT_PUBLIC_BETA_ONLY: "false",
        BETA_ACCESS_CODE: "still-there",
      })
    ).toBe(false);
    expect(
      requiresBetaCode({
        NEXT_PUBLIC_BETA_ONLY: "true",
      })
    ).toBe(true);
  });

  it("is independent of COGNOTE_DEPLOYMENT", () => {
    expect(
      requiresBetaCode({
        COGNOTE_DEPLOYMENT: "hosted",
        NEXT_PUBLIC_BETA_ONLY: "false",
      })
    ).toBe(false);
    expect(
      requiresBetaCode({
        COGNOTE_DEPLOYMENT: "self_hosted",
        BETA_ACCESS_CODE: "x",
      })
    ).toBe(true);
  });
});

describe("resolveEffectivePlan", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("never applies soft limits on self_hosted", () => {
    const e = resolveEffectivePlan(freeTeacher, {
      now,
      env: { COGNOTE_DEPLOYMENT: "self_hosted" },
    });
    expect(e.softLimitsApply).toBe(false);
    expect(e.deployment).toBe("self_hosted");
  });

  it("applies soft limits for free on hosted", () => {
    const e = resolveEffectivePlan(freeTeacher, {
      now,
      env: { COGNOTE_DEPLOYMENT: "hosted" },
    });
    expect(e.plan).toBe("free");
    expect(e.softLimitsApply).toBe(true);
  });

  it("keeps trial until trial_ends_at", () => {
    const e = resolveEffectivePlan(
      {
        hosted_plan: "trial",
        trial_ends_at: "2026-08-01T00:00:00.000Z",
        gifted_until: null,
      },
      { now, env: { COGNOTE_DEPLOYMENT: "hosted" } }
    );
    expect(e.plan).toBe("trial");
    expect(e.softLimitsApply).toBe(false);
    expect(e.demotedFrom).toBeNull();
  });

  it("demotes expired trial to free", () => {
    const e = resolveEffectivePlan(
      {
        hosted_plan: "trial",
        trial_ends_at: "2026-07-01T00:00:00.000Z",
        gifted_until: null,
      },
      { now, env: { COGNOTE_DEPLOYMENT: "hosted" } }
    );
    expect(e.plan).toBe("free");
    expect(e.softLimitsApply).toBe(true);
    expect(e.demotedFrom).toBe("trial");
  });

  it("demotes expired gift to free", () => {
    const e = resolveEffectivePlan(
      {
        hosted_plan: "gifted",
        trial_ends_at: null,
        gifted_until: "2026-06-01T00:00:00.000Z",
      },
      { now, env: { COGNOTE_DEPLOYMENT: "hosted" } }
    );
    expect(e.plan).toBe("free");
    expect(e.demotedFrom).toBe("gifted");
  });

  it("keeps active gift unlimited", () => {
    const e = resolveEffectivePlan(
      {
        hosted_plan: "gifted",
        trial_ends_at: null,
        gifted_until: "2026-12-01T00:00:00.000Z",
      },
      { now, env: { COGNOTE_DEPLOYMENT: "hosted" } }
    );
    expect(e.plan).toBe("gifted");
    expect(e.softLimitsApply).toBe(false);
  });

  it("pro and founding never soft-limit", () => {
    for (const plan of ["pro", "founding"] as const) {
      const e = resolveEffectivePlan(
        { hosted_plan: plan, trial_ends_at: null, gifted_until: null },
        { now, env: { COGNOTE_DEPLOYMENT: "hosted" } }
      );
      expect(e.softLimitsApply).toBe(false);
      expect(e.plan).toBe(plan);
    }
  });
});

describe("evaluateLimit", () => {
  const env = { COGNOTE_DEPLOYMENT: "hosted" };
  const entitlement = resolveEffectivePlan(freeTeacher, {
    now: new Date(),
    env,
  });

  it("allows creates under the cap", () => {
    const r = evaluateLimit(entitlement, "students", 4, 1);
    expect(r.allowed).toBe(true);
  });

  it("blocks the 6th active student", () => {
    const r = evaluateLimit(entitlement, "students", 5, 1);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(HOSTED_LIMIT_ERROR_CODE);
    expect(r.message).toMatch(/Free hosted plan allows/i);
    expect(r.message).toMatch(/self-host/i);
  });

  it("blocks bulk add that would exceed", () => {
    const r = evaluateLimit(entitlement, "students", 3, 3);
    expect(r.allowed).toBe(false);
  });
});

describe("hostedSignupFields", () => {
  it("starts trial on hosted", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const fields = hostedSignupFields(
      { COGNOTE_DEPLOYMENT: "hosted", HOSTED_TRIAL_DAYS: "30" },
      now
    );
    expect(fields.hosted_plan).toBe("trial");
    expect(fields.trial_ends_at).toBe("2026-08-12T00:00:00.000Z");
  });

  it("leaves free on self_hosted", () => {
    const fields = hostedSignupFields({ COGNOTE_DEPLOYMENT: "self_hosted" });
    expect(fields.hosted_plan).toBe("free");
    expect(fields.trial_ends_at).toBeNull();
  });
});

describe("formatHostedPrice", () => {
  it("formats whole dollars", () => {
    expect(formatHostedPrice(500)).toBe("$5");
  });
});
