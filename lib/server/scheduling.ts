import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_POLICY,
  computeOccurrences,
  type StudioPolicy,
  type SlotRow,
} from "@/lib/schedule";

/**
 * Server-side scheduling operations, shared by the teacher schedule page,
 * the parent portal, and the .ics feed. Works with either an RLS-scoped
 * client (teacher pages) or the service-role client (portal/token access).
 */

export async function getPolicy(
  supabase: SupabaseClient,
  teacherId: string
): Promise<StudioPolicy> {
  const { data } = await supabase
    .from("studio_policies")
    .select("*")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!data) return DEFAULT_POLICY;
  const policy = { ...DEFAULT_POLICY, ...data };
  // BYO secrets are encrypted at rest; every server-side consumer reads
  // policies through here, so this is the single decryption point.
  const { decryptSecret } = await import("@/lib/token");
  policy.stripe_secret_key = decryptSecret(policy.stripe_secret_key);
  policy.stripe_webhook_secret = decryptSecret(policy.stripe_webhook_secret);
  policy.ai_api_key = decryptSecret(policy.ai_api_key);
  return policy;
}

/**
 * Idempotently materialize lesson occurrences from active slots for
 * [from, to] (inclusive "YYYY-MM-DD" local dates). Existing rows are left
 * untouched via ON CONFLICT (slot_id, lesson_date) DO NOTHING, so manual
 * edits and attendance on already-materialized lessons are never clobbered.
 */
export async function materializeLessons(
  supabase: SupabaseClient,
  teacherId: string,
  from: string,
  to: string
): Promise<void> {
  const [policy, { data: slots }] = await Promise.all([
    getPolicy(supabase, teacherId),
    supabase
      .from("lesson_slots")
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("active", true),
  ]);

  const rows = ((slots ?? []) as SlotRow[]).flatMap((slot) =>
    computeOccurrences(slot, from, to, policy.timezone)
  );
  if (rows.length === 0) return;

  const { error } = await supabase.from("lessons").upsert(rows, {
    onConflict: "slot_id,lesson_date",
    ignoreDuplicates: true,
  });
  if (error) {
    console.error("materializeLessons upsert failed:", error.message);
  }
}
