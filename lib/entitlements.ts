/**
 * Hosted CogNote entitlements.
 *
 * Free soft limits (students / plans / sheet) apply when COGNOTE_DEPLOYMENT=hosted
 * and the teacher's effective plan is free. Sheet music also has a high Pro cap
 * for trial / gifted / pro / founding. Self-host (default) = full product, no paywall.
 */

export type DeploymentMode = "self_hosted" | "hosted";

export type HostedPlan = "free" | "trial" | "pro" | "founding" | "gifted";

export type LimitResource = "students" | "plans" | "sheet_music";

export interface TeacherEntitlementRow {
  hosted_plan: HostedPlan | string | null;
  trial_ends_at: string | null;
  gifted_until: string | null;
  stripe_subscription_id?: string | null;
  founding_number?: number | null;
}

export interface HostedLimits {
  maxStudents: number;
  maxPlans: number;
  /** Free-tier sheet music item cap. */
  maxSheetItems: number;
  /** Trial / gifted / pro / founding sheet music item cap. */
  maxSheetItemsPro: number;
}

export interface EffectiveEntitlement {
  deployment: DeploymentMode;
  /** Stored plan after lazy demotion of expired trial/gift. */
  plan: HostedPlan;
  softLimitsApply: boolean;
  trialEndsAt: Date | null;
  giftedUntil: Date | null;
  /** True when stored trial/gifted expired into free. */
  demotedFrom: "trial" | "gifted" | null;
  limits: HostedLimits;
  monthlyPriceCents: number;
}

export const DEFAULT_HOSTED_FREE_MAX_STUDENTS = 5;
export const DEFAULT_HOSTED_FREE_MAX_PLANS = 5;
export const DEFAULT_HOSTED_FREE_MAX_SHEET_ITEMS = 5;
export const DEFAULT_HOSTED_PRO_MAX_SHEET_ITEMS = 100;
export const DEFAULT_HOSTED_TRIAL_DAYS = 30;
export const DEFAULT_HOSTED_MONTHLY_PRICE_CENTS = 500;

export const HOSTED_LIMIT_ERROR_CODE = "HOSTED_LIMIT_REACHED";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getDeploymentMode(
  env: Record<string, string | undefined> = process.env
): DeploymentMode {
  const v = env.COGNOTE_DEPLOYMENT?.trim().toLowerCase();
  return v === "hosted" ? "hosted" : "self_hosted";
}

function parsePublicFlag(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

/**
 * Whether signup/login should show the beta-code field and waitlist chrome.
 *
 * - `NEXT_PUBLIC_BETA_ONLY=true|false` wins when set (hosted invite-only vs open signup)
 * - otherwise falls back to `BETA_ACCESS_CODE` being set (server-only secret)
 *
 * Orthogonal to `COGNOTE_DEPLOYMENT` — self-host can use a beta code; hosted can
 * open signup while keeping soft limits.
 *
 * Optional `env` is for unit tests. Call with no args in app code so Next can
 * inline `NEXT_PUBLIC_BETA_ONLY` (dynamic `process.env[name]` breaks on client).
 */
export function requiresBetaCode(
  env?: Record<string, string | undefined>
): boolean {
  const betaOnlyRaw = env
    ? env.NEXT_PUBLIC_BETA_ONLY
    : process.env.NEXT_PUBLIC_BETA_ONLY;
  const explicit = parsePublicFlag(betaOnlyRaw);
  if (explicit !== undefined) return explicit;
  const code = env ? env.BETA_ACCESS_CODE : process.env.BETA_ACCESS_CODE;
  return Boolean(code?.trim());
}

/** @deprecated Prefer `requiresBetaCode` — same behavior. */
export function isBetaGateEnabled(
  env?: Record<string, string | undefined>
): boolean {
  return requiresBetaCode(env);
}

export function getHostedTrialDays(
  env: Record<string, string | undefined> = process.env
): number {
  return parsePositiveInt(env.HOSTED_TRIAL_DAYS, DEFAULT_HOSTED_TRIAL_DAYS);
}

export function getHostedLimits(
  env: Record<string, string | undefined> = process.env
): HostedLimits {
  return {
    maxStudents: parsePositiveInt(
      env.HOSTED_FREE_MAX_STUDENTS,
      DEFAULT_HOSTED_FREE_MAX_STUDENTS
    ),
    maxPlans: parsePositiveInt(
      env.HOSTED_FREE_MAX_LESSON_TEMPLATES,
      DEFAULT_HOSTED_FREE_MAX_PLANS
    ),
    maxSheetItems: parsePositiveInt(
      env.HOSTED_FREE_MAX_SHEET_ITEMS,
      DEFAULT_HOSTED_FREE_MAX_SHEET_ITEMS
    ),
    maxSheetItemsPro: parsePositiveInt(
      env.HOSTED_PRO_MAX_SHEET_ITEMS,
      DEFAULT_HOSTED_PRO_MAX_SHEET_ITEMS
    ),
  };
}

/** Effective sheet-music item cap for this entitlement, or null if none. */
export function effectiveSheetMusicLimit(
  entitlement: EffectiveEntitlement
): number | null {
  if (entitlement.deployment === "self_hosted") return null;
  return entitlement.softLimitsApply
    ? entitlement.limits.maxSheetItems
    : entitlement.limits.maxSheetItemsPro;
}

export function getHostedMonthlyPriceCents(
  env: Record<string, string | undefined> = process.env
): number {
  return parsePositiveInt(
    env.HOSTED_MONTHLY_PRICE_CENTS,
    DEFAULT_HOSTED_MONTHLY_PRICE_CENTS
  );
}

export function formatHostedPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function parseHostedPlan(raw: string | null | undefined): HostedPlan {
  switch (raw) {
    case "trial":
    case "pro":
    case "founding":
    case "gifted":
    case "free":
      return raw;
    default:
      return "free";
  }
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lazy demotion: expired trial/gift → free. Never trusts a stale plan string
 * alone when dates say otherwise. Pro/founding stay without free soft limits
 * until Stripe/SQL change them (sheet music still has a Pro item cap).
 */
export function resolveEffectivePlan(
  teacher: TeacherEntitlementRow | null | undefined,
  opts?: { now?: Date; env?: Record<string, string | undefined> }
): EffectiveEntitlement {
  const env = opts?.env ?? process.env;
  const now = opts?.now ?? new Date();
  const deployment = getDeploymentMode(env);
  const limits = getHostedLimits(env);
  const monthlyPriceCents = getHostedMonthlyPriceCents(env);

  if (deployment === "self_hosted") {
    return {
      deployment,
      plan: "free",
      softLimitsApply: false,
      trialEndsAt: null,
      giftedUntil: null,
      demotedFrom: null,
      limits,
      monthlyPriceCents,
    };
  }

  const stored = parseHostedPlan(teacher?.hosted_plan);
  const trialEndsAt = parseDate(teacher?.trial_ends_at);
  const giftedUntil = parseDate(teacher?.gifted_until);

  if (stored === "pro" || stored === "founding") {
    return {
      deployment,
      plan: stored,
      softLimitsApply: false,
      trialEndsAt,
      giftedUntil,
      demotedFrom: null,
      limits,
      monthlyPriceCents,
    };
  }

  if (stored === "gifted") {
    if (giftedUntil && giftedUntil.getTime() > now.getTime()) {
      return {
        deployment,
        plan: "gifted",
        softLimitsApply: false,
        trialEndsAt,
        giftedUntil,
        demotedFrom: null,
        limits,
        monthlyPriceCents,
      };
    }
    return {
      deployment,
      plan: "free",
      softLimitsApply: true,
      trialEndsAt,
      giftedUntil,
      demotedFrom: "gifted",
      limits,
      monthlyPriceCents,
    };
  }

  if (stored === "trial") {
    if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
      return {
        deployment,
        plan: "trial",
        softLimitsApply: false,
        trialEndsAt,
        giftedUntil,
        demotedFrom: null,
        limits,
        monthlyPriceCents,
      };
    }
    return {
      deployment,
      plan: "free",
      softLimitsApply: true,
      trialEndsAt,
      giftedUntil,
      demotedFrom: "trial",
      limits,
      monthlyPriceCents,
    };
  }

  return {
    deployment,
    plan: "free",
    softLimitsApply: true,
    trialEndsAt,
    giftedUntil,
    demotedFrom: null,
    limits,
    monthlyPriceCents,
  };
}

/** Fields to insert on teacher create when deployment is hosted. */
export function hostedSignupFields(
  env: Record<string, string | undefined> = process.env,
  now = new Date()
): {
  hosted_plan: HostedPlan;
  trial_ends_at: string | null;
} {
  if (getDeploymentMode(env) !== "hosted") {
    return { hosted_plan: "free", trial_ends_at: null };
  }
  const days = getHostedTrialDays(env);
  const ends = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    hosted_plan: "trial",
    trial_ends_at: ends.toISOString(),
  };
}

export function limitForResource(
  resource: LimitResource,
  limits: HostedLimits,
  opts?: { proSheet?: boolean }
): number {
  switch (resource) {
    case "students":
      return limits.maxStudents;
    case "plans":
      return limits.maxPlans;
    case "sheet_music":
      return opts?.proSheet ? limits.maxSheetItemsPro : limits.maxSheetItems;
  }
}

export function resourceLabel(resource: LimitResource): string {
  switch (resource) {
    case "students":
      return "active students";
    case "plans":
      return "practice lessons";
    case "sheet_music":
      return "sheet music items";
  }
}

export function hostedLimitMessage(
  resource: LimitResource,
  limit: number,
  monthlyPriceCents: number
): string {
  const price = formatHostedPrice(monthlyPriceCents);
  return `Free hosted plan allows ${limit} ${resourceLabel(resource)}. Upgrade to Pro (${price}/mo), or export and self-host.`;
}

export function hostedProSheetLimitMessage(limit: number): string {
  return `Hosted plan allows ${limit} sheet music items. Remove unused scores, or export and self-host for larger libraries.`;
}

export interface LimitCheckResult {
  allowed: boolean;
  entitlement: EffectiveEntitlement;
  currentCount: number;
  limit: number | null;
  code?: typeof HOSTED_LIMIT_ERROR_CODE;
  message?: string;
}

export function evaluateLimit(
  entitlement: EffectiveEntitlement,
  resource: LimitResource,
  currentCount: number,
  adding = 1
): LimitCheckResult {
  if (entitlement.deployment === "self_hosted") {
    return {
      allowed: true,
      entitlement,
      currentCount,
      limit: null,
    };
  }

  // Sheet music: free uses free cap; trial/gifted/pro/founding use Pro cap.
  if (resource === "sheet_music") {
    const limit = effectiveSheetMusicLimit(entitlement);
    if (limit == null) {
      return { allowed: true, entitlement, currentCount, limit: null };
    }
    if (currentCount + adding <= limit) {
      return { allowed: true, entitlement, currentCount, limit };
    }
    return {
      allowed: false,
      entitlement,
      currentCount,
      limit,
      code: HOSTED_LIMIT_ERROR_CODE,
      message: entitlement.softLimitsApply
        ? hostedLimitMessage(
            resource,
            limit,
            entitlement.monthlyPriceCents
          )
        : hostedProSheetLimitMessage(limit),
    };
  }

  if (!entitlement.softLimitsApply) {
    return {
      allowed: true,
      entitlement,
      currentCount,
      limit: null,
    };
  }
  const limit = limitForResource(resource, entitlement.limits);
  if (currentCount + adding <= limit) {
    return { allowed: true, entitlement, currentCount, limit };
  }
  return {
    allowed: false,
    entitlement,
    currentCount,
    limit,
    code: HOSTED_LIMIT_ERROR_CODE,
    message: hostedLimitMessage(
      resource,
      limit,
      entitlement.monthlyPriceCents
    ),
  };
}

/** Human label for Account / hosting options. */
export function planDisplayName(plan: HostedPlan): string {
  switch (plan) {
    case "trial":
      return "Trial";
    case "pro":
      return "Pro";
    case "founding":
      return "Founding";
    case "gifted":
      return "Pro (gifted)";
    case "free":
      return "Free";
  }
}
