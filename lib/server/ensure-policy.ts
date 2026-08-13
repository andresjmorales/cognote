import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTimezone } from "@/lib/timezones";
import { isUniqueViolation } from "@/lib/onboarding";

/**
 * Persist a studio_policies row for a new teacher so DB defaults (per-hour,
 * make-up rules, notifications, …) apply immediately — not only after the
 * first Studio save. Safe to call repeatedly (ignoreDuplicates).
 * Optional timezone (from browser at signup) overrides the DB default.
 */
export async function ensureStudioPolicyRow(
  supabase: SupabaseClient,
  teacherId: string,
  timezone?: string | null
): Promise<{ ok: boolean }> {
  const row: { teacher_id: string; timezone?: string } = {
    teacher_id: teacherId,
  };
  if (timezone && isValidTimezone(timezone)) {
    row.timezone = timezone;
  }

  const { error } = await supabase.from("studio_policies").upsert(row, {
    onConflict: "teacher_id",
    ignoreDuplicates: true,
  });
  if (error && !isUniqueViolation(error)) {
    console.error("ensureStudioPolicyRow failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
