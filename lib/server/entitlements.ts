import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateLimit,
  HOSTED_LIMIT_ERROR_CODE,
  resolveEffectivePlan,
  type LimitCheckResult,
  type LimitResource,
  type TeacherEntitlementRow,
} from "@/lib/entitlements";

const TEACHER_ENTITLEMENT_SELECT =
  "hosted_plan, trial_ends_at, gifted_until, stripe_subscription_id, founding_number";

export async function loadTeacherEntitlements(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherEntitlementRow | null> {
  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_ENTITLEMENT_SELECT)
    .eq("id", teacherId)
    .maybeSingle();

  if (error) {
    console.error("loadTeacherEntitlements:", error);
    return null;
  }
  return data as TeacherEntitlementRow | null;
}

/**
 * Persist lazy demotion (trial/gift → free) so Settings stays honest.
 * Safe to call often; no-op when nothing changed.
 */
export async function persistDemotionIfNeeded(
  supabase: SupabaseClient,
  teacherId: string,
  stored: TeacherEntitlementRow | null,
  demotedFrom: "trial" | "gifted" | null
): Promise<void> {
  if (!demotedFrom || !stored) return;
  if (stored.hosted_plan === "free") return;
  const { error } = await supabase
    .from("teachers")
    .update({ hosted_plan: "free" })
    .eq("id", teacherId);
  if (error) {
    console.error("persistDemotionIfNeeded:", error);
  }
}

export async function countActiveStudents(
  supabase: SupabaseClient,
  teacherId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("archived_at", null);

  if (error) {
    console.error("countActiveStudents:", error);
    return 0;
  }
  return count ?? 0;
}

export async function countPlans(
  supabase: SupabaseClient,
  teacherId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("countPlans:", error);
    return 0;
  }
  return count ?? 0;
}

export async function countSheetItems(
  supabase: SupabaseClient,
  teacherId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("music_library_items")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("countSheetItems:", error);
    return 0;
  }
  return count ?? 0;
}

async function countForResource(
  supabase: SupabaseClient,
  teacherId: string,
  resource: LimitResource
): Promise<number> {
  switch (resource) {
    case "students":
      return countActiveStudents(supabase, teacherId);
    case "plans":
      return countPlans(supabase, teacherId);
    case "sheet_music":
      return countSheetItems(supabase, teacherId);
  }
}

/**
 * Server-side gate for create paths. Returns a LimitCheckResult; callers
 * should respond with 403 + HOSTED_LIMIT_REACHED when !allowed.
 */
export async function assertWithinHostedLimit(
  supabase: SupabaseClient,
  teacherId: string,
  resource: LimitResource,
  adding = 1
): Promise<LimitCheckResult> {
  const stored = await loadTeacherEntitlements(supabase, teacherId);
  const entitlement = resolveEffectivePlan(stored);
  await persistDemotionIfNeeded(
    supabase,
    teacherId,
    stored,
    entitlement.demotedFrom
  );

  if (!entitlement.softLimitsApply) {
    return evaluateLimit(entitlement, resource, 0, adding);
  }

  const currentCount = await countForResource(supabase, teacherId, resource);
  return evaluateLimit(entitlement, resource, currentCount, adding);
}

export function limitReachedResponse(check: LimitCheckResult) {
  return {
    error: check.message ?? "Hosted free limit reached",
    code: check.code ?? HOSTED_LIMIT_ERROR_CODE,
    resourceLimit: check.limit,
    currentCount: check.currentCount,
    plan: check.entitlement.plan,
    upgradePath: "/hosting",
  };
}
