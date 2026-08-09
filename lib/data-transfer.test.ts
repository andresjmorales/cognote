import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DATA_EXPORT_VERSION,
  parseExportPayload,
  importStudioExport,
  type StudioDataExport,
} from "@/lib/data-transfer";

function emptyTables(): StudioDataExport["tables"] {
  return {
    studio_policies: null,
    guardians: [],
    students: [],
    plans: [],
    lesson_slots: [],
    lessons: [],
    attendance: [],
    lesson_notes: [],
    student_plans: [],
    practice_sessions: [],
    note_attempts: [],
    flashcard_progress: [],
    skill_dimensions: [],
    skill_assessments: [],
    invoices: [],
    invoice_items: [],
    payments: [],
  };
}

function payloadWithVersion(version: number): StudioDataExport {
  return {
    version,
    exportedAt: new Date().toISOString(),
    teacherId: "00000000-0000-0000-0000-000000000001",
    tables: emptyTables(),
  };
}

/** Minimal stub: records upserts per table, returns no errors. */
function stubSupabase(upserts: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      return {
        upsert(rows: unknown[]) {
          upserts[table] = [...(upserts[table] ?? []), ...rows];
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({ data: { display_name: "Existing Name" } }),
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("parseExportPayload", () => {
  it("accepts current-version (v2) files", () => {
    expect(parseExportPayload(payloadWithVersion(DATA_EXPORT_VERSION))).not.toBeNull();
  });

  it("accepts legacy v1 files", () => {
    expect(parseExportPayload(payloadWithVersion(1))).not.toBeNull();
  });

  it("rejects unknown future versions", () => {
    expect(parseExportPayload(payloadWithVersion(3))).toBeNull();
  });

  it("rejects payloads without tables", () => {
    const bad = { version: DATA_EXPORT_VERSION, exportedAt: "", teacherId: "" };
    expect(parseExportPayload(bad)).toBeNull();
  });
});

describe("importStudioExport", () => {
  const teacherId = "00000000-0000-0000-0000-000000000002";

  it("imports a v1 file (no v2 tables) without errors", async () => {
    const upserts: Record<string, unknown[]> = {};
    const payload = payloadWithVersion(1);
    payload.tables.students = [{ id: "s1", name: "Ada" }];

    const result = await importStudioExport(stubSupabase(upserts), teacherId, payload);

    expect(result.ok).toBe(true);
    expect(upserts.students).toEqual([{ id: "s1", name: "Ada", teacher_id: teacherId }]);
    // v2-only tables have no rows to upsert in a v1 file
    expect(upserts.music_library_items).toBeUndefined();
    expect(upserts.events).toBeUndefined();
  });

  it("imports v2 music/event tables and rewrites teacher_id", async () => {
    const upserts: Record<string, unknown[]> = {};
    const payload = payloadWithVersion(DATA_EXPORT_VERSION);
    payload.tables.music_library_items = [
      { id: "m1", title: "Sonatina", teacher_id: "someone-else" },
    ];
    payload.tables.sheet_music_assignments = [{ id: "a1", music_item_id: "m1" }];
    payload.tables.events = [{ id: "e1", title: "Recital", teacher_id: "someone-else" }];
    payload.tables.event_students = [{ id: "es1", event_id: "e1" }];
    payload.tables.event_rsvps = [{ id: "r1", event_id: "e1" }];

    const result = await importStudioExport(stubSupabase(upserts), teacherId, payload);

    expect(result.ok).toBe(true);
    expect(upserts.music_library_items?.[0]).toMatchObject({
      id: "m1",
      teacher_id: teacherId,
    });
    expect(upserts.events?.[0]).toMatchObject({ id: "e1", teacher_id: teacherId });
    expect(upserts.sheet_music_assignments).toHaveLength(1);
    expect(upserts.event_students).toHaveLength(1);
    expect(upserts.event_rsvps).toHaveLength(1);
  });

  it("rejects unsupported versions", async () => {
    const result = await importStudioExport(
      stubSupabase({}),
      teacherId,
      payloadWithVersion(99)
    );
    expect(result.ok).toBe(false);
  });
});
