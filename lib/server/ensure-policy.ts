import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persist a studio_policies row for a new teacher so DB defaults (per-hour,
 * make-up rules, notifications, …) apply immediately — not only after the
 * first Settings save. Safe to call repeatedly (ignoreDuplicates).
 */
export async function ensureStudioPolicyRow(
  supabase: SupabaseClient,
  teacherId: string
): Promise<void> {
  const { error } = await supabase.from("studio_policies").upsert(
    { teacher_id: teacherId },
    { onConflict: "teacher_id", ignoreDuplicates: true }
  );
  if (error) {
    console.error("ensureStudioPolicyRow failed:", error.message);
  }
}
