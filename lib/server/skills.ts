import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Default skill dimensions (ROADMAP §4), seeded lazily the first time a
 * teacher's dimension list is read — so future sign-ups get them too,
 * which a migration-time seed can't do.
 */
export const DEFAULT_DIMENSIONS = [
  "Musicianship",
  "Rhythm",
  "Sight Reading",
  "Technique",
  "Musicality",
  "Theory",
];

export interface SkillDimension {
  id: string;
  name: string;
  sort_order: number;
}

export async function getOrSeedDimensions(
  supabase: SupabaseClient,
  teacherId: string
): Promise<SkillDimension[]> {
  const { data: existing, error } = await supabase
    .from("skill_dimensions")
    .select("id, name, sort_order")
    .eq("teacher_id", teacherId)
    .order("sort_order")
    .order("name");

  if (error) throw new Error(error.message);
  if (existing.length > 0) return existing;

  const { data: seeded, error: seedError } = await supabase
    .from("skill_dimensions")
    .insert(
      DEFAULT_DIMENSIONS.map((name, i) => ({
        teacher_id: teacherId,
        name,
        sort_order: i,
      }))
    )
    .select("id, name, sort_order");

  if (seedError) {
    // Concurrent seed from another request — re-read instead of failing.
    if (seedError.code === "23505") {
      const { data: reread } = await supabase
        .from("skill_dimensions")
        .select("id, name, sort_order")
        .eq("teacher_id", teacherId)
        .order("sort_order")
        .order("name");
      return reread ?? [];
    }
    throw new Error(seedError.message);
  }

  return seeded;
}
