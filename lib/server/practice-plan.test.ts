import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withStudioNoteNames } from "@/lib/server/practice-plan";

/** Stub of the one query the helper makes. */
function clientReturning(row: { note_naming_system: string } | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const plan = {
  teacher_id: "teacher-1",
  name: "Symbols",
  symbols: [
    { id: "half-note", symbol: "𝅗𝅥", term: "Half Note", definition: "2 beats" },
    { id: "sharp", symbol: "♯", term: "Sharp", definition: "Raise the pitch" },
  ],
};

describe("withStudioNoteNames", () => {
  it("renames note values in the studio's vocabulary", async () => {
    const out = (await withStudioNoteNames(
      clientReturning({ note_naming_system: "uk" }),
      plan
    )) as { symbols: { term: string }[] };

    expect(out.symbols.map((s) => s.term)).toEqual(["Minim", "Sharp"]);
  });

  it("leaves the plan American when the studio has not switched", async () => {
    const out = (await withStudioNoteNames(
      clientReturning({ note_naming_system: "us" }),
      plan
    )) as { symbols: { term: string }[] };

    expect(out.symbols.map((s) => s.term)).toEqual(["Half Note", "Sharp"]);
  });

  it("never returns the teacher id, in any path", async () => {
    const renamed = (await withStudioNoteNames(
      clientReturning({ note_naming_system: "uk" }),
      plan
    )) as Record<string, unknown>;
    const untouched = (await withStudioNoteNames(
      clientReturning(null),
      { ...plan, teacher_id: undefined }
    )) as Record<string, unknown>;

    expect(renamed).not.toHaveProperty("teacher_id");
    expect(untouched).not.toHaveProperty("teacher_id");
    expect(renamed.name).toBe("Symbols");
  });

  it("falls back to American names for a value outside the two systems", async () => {
    const out = (await withStudioNoteNames(
      clientReturning({ note_naming_system: "gb" }),
      plan
    )) as { symbols: { term: string }[] };

    expect(out.symbols[0].term).toBe("Half Note");
  });

  it("passes a null or symbol-less plan through unchanged", async () => {
    expect(await withStudioNoteNames(clientReturning(null), null)).toBeNull();

    const noSymbols = { teacher_id: "teacher-1", name: "Notes", symbols: [] };
    expect(await withStudioNoteNames(clientReturning(null), noSymbols)).toEqual({
      name: "Notes",
      symbols: [],
    });
  });
});
