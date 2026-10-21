import type { SupabaseClient } from "@supabase/supabase-js";
import { isNamingSystem, localizeSymbols, type MusicalSymbol } from "@/lib/symbols";

/**
 * Hand a lesson plan to a practice surface in the studio's own vocabulary.
 *
 * `plans.symbols` is a snapshot taken when the plan was written, always spelled
 * American; renaming by symbol id makes an old plan follow the studio's current
 * setting (see `lib/symbols.ts`). `teacher_id` is dropped from the payload — a
 * token holder has no use for it.
 */
export async function withStudioNoteNames(
  supabase: SupabaseClient,
  plan: unknown
): Promise<unknown> {
  if (!plan || typeof plan !== "object") return plan;

  const { teacher_id, symbols, ...rest } = plan as {
    teacher_id?: string | null;
    symbols?: unknown;
  };
  if (!teacher_id || !Array.isArray(symbols)) return { ...rest, symbols };

  // One column, not getPolicy(): this runs on the public practice endpoint and
  // has no use for the studio's BYO secrets.
  const { data } = await supabase
    .from("studio_policies")
    .select("note_naming_system")
    .eq("teacher_id", teacher_id)
    .maybeSingle();
  const system = isNamingSystem(data?.note_naming_system)
    ? data.note_naming_system
    : "us";

  return { ...rest, symbols: localizeSymbols(symbols as MusicalSymbol[], system) };
}
