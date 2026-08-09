import type { SupabaseClient } from "@supabase/supabase-js";

export const DATA_EXPORT_VERSION = 2 as const;
/** v1 files (pre music/events/profile) import fine; missing tables are empty. */
const SUPPORTED_IMPORT_VERSIONS: readonly number[] = [1, 2];

export type StudioDataExport = {
  version: number;
  exportedAt: string;
  teacherId: string;
  /** Non-entitlement profile subset (v2+). Never includes hosted/Stripe fields. */
  teacher_profile?: { display_name?: string } | null;
  tables: {
    studio_policies: Record<string, unknown> | null;
    guardians: Record<string, unknown>[];
    students: Record<string, unknown>[];
    plans: Record<string, unknown>[];
    lesson_slots: Record<string, unknown>[];
    lessons: Record<string, unknown>[];
    attendance: Record<string, unknown>[];
    lesson_notes: Record<string, unknown>[];
    student_plans: Record<string, unknown>[];
    practice_sessions: Record<string, unknown>[];
    note_attempts: Record<string, unknown>[];
    flashcard_progress: Record<string, unknown>[];
    skill_dimensions: Record<string, unknown>[];
    skill_assessments: Record<string, unknown>[];
    invoices: Record<string, unknown>[];
    invoice_items: Record<string, unknown>[];
    payments: Record<string, unknown>[];
    // v2 additions (absent in v1 files)
    music_library_items?: Record<string, unknown>[];
    sheet_music_assignments?: Record<string, unknown>[];
    events?: Record<string, unknown>[];
    event_students?: Record<string, unknown>[];
    event_rsvps?: Record<string, unknown>[];
  };
};

function asRows(data: unknown): Record<string, unknown>[] {
  return (data as Record<string, unknown>[] | null) ?? [];
}

/**
 * BYO payment/AI credentials never leave the account in an export file.
 * (Old export files that still contain them import fine; the keys are just
 * re-saved as configured.)
 */
const POLICY_SECRET_FIELDS = [
  "stripe_secret_key",
  "stripe_publishable_key",
  "stripe_webhook_secret",
  "ai_api_key",
] as const;

function stripPolicySecrets(
  policy: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!policy) return policy;
  const cleaned = { ...policy };
  for (const field of POLICY_SECRET_FIELDS) {
    cleaned[field] = null;
  }
  return cleaned;
}

/** Fetch every teacher-owned row for backup / migration. */
export async function buildStudioExport(
  supabase: SupabaseClient,
  teacherId: string
): Promise<StudioDataExport> {
  const [
    policyRes,
    guardiansRes,
    studentsRes,
    plansRes,
    slotsRes,
    lessonsRes,
    dimensionsRes,
    invoicesRes,
    musicRes,
    eventsRes,
    profileRes,
  ] = await Promise.all([
    supabase.from("studio_policies").select("*").eq("teacher_id", teacherId).maybeSingle(),
    supabase.from("guardians").select("*").eq("teacher_id", teacherId),
    supabase.from("students").select("*").eq("teacher_id", teacherId),
    supabase.from("plans").select("*").eq("teacher_id", teacherId),
    supabase.from("lesson_slots").select("*").eq("teacher_id", teacherId),
    supabase.from("lessons").select("*").eq("teacher_id", teacherId),
    supabase.from("skill_dimensions").select("*").eq("teacher_id", teacherId),
    supabase.from("invoices").select("*").eq("teacher_id", teacherId),
    supabase.from("music_library_items").select("*").eq("teacher_id", teacherId),
    supabase.from("events").select("*").eq("teacher_id", teacherId),
    supabase.from("teachers").select("display_name").eq("id", teacherId).maybeSingle(),
  ]);

  const students = asRows(studentsRes.data);
  const studentIds = students.map((s) => s.id as string);
  const lessonIds = asRows(lessonsRes.data).map((l) => l.id as string);
  const planIds = asRows(plansRes.data).map((p) => p.id as string);
  const dimensionIds = asRows(dimensionsRes.data).map((d) => d.id as string);
  const invoiceIds = asRows(invoicesRes.data).map((i) => i.id as string);
  const musicItemIds = asRows(musicRes.data).map((m) => m.id as string);
  const eventIds = asRows(eventsRes.data).map((e) => e.id as string);

  const [
    attendanceRes,
    notesRes,
    studentPlansRes,
    assessmentsRes,
    itemsRes,
    paymentsRes,
  ] = await Promise.all([
    lessonIds.length
      ? supabase.from("attendance").select("*").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length
      ? supabase.from("lesson_notes").select("*").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase.from("student_plans").select("*").in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length && dimensionIds.length
      ? supabase.from("skill_assessments").select("*").in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    invoiceIds.length
      ? supabase.from("invoice_items").select("*").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
    invoiceIds.length
      ? supabase.from("payments").select("*").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
  ]);

  const [musicAssignmentsRes, eventStudentsRes, eventRsvpsRes] = await Promise.all([
    musicItemIds.length
      ? supabase
          .from("sheet_music_assignments")
          .select("*")
          .in("music_item_id", musicItemIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_students").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_rsvps").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentPlans = asRows(studentPlansRes.data);
  const studentPlanIds = studentPlans.map((sp) => sp.id as string);

  const [sessionsRes, flashRes] = await Promise.all([
    studentPlanIds.length
      ? supabase.from("practice_sessions").select("*").in("student_plan_id", studentPlanIds)
      : Promise.resolve({ data: [] }),
    studentPlanIds.length
      ? supabase.from("flashcard_progress").select("*").in("student_plan_id", studentPlanIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sessions = asRows(sessionsRes.data);
  const sessionIds = sessions.map((s) => s.id as string);

  const attemptsRes = sessionIds.length
    ? await supabase.from("note_attempts").select("*").in("session_id", sessionIds)
    : { data: [] };

  // Drop unused planIds to satisfy lint if needed — keep for clarity of scope
  void planIds;

  return {
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    teacherId,
    teacher_profile: profileRes.data
      ? { display_name: (profileRes.data as { display_name?: string }).display_name ?? "" }
      : null,
    tables: {
      studio_policies: stripPolicySecrets(
        (policyRes.data as Record<string, unknown> | null) ?? null
      ),
      guardians: asRows(guardiansRes.data),
      students,
      plans: asRows(plansRes.data),
      lesson_slots: asRows(slotsRes.data),
      lessons: asRows(lessonsRes.data),
      attendance: asRows(attendanceRes.data),
      lesson_notes: asRows(notesRes.data),
      student_plans: studentPlans,
      practice_sessions: sessions,
      note_attempts: asRows(attemptsRes.data),
      flashcard_progress: asRows(flashRes.data),
      skill_dimensions: asRows(dimensionsRes.data),
      skill_assessments: asRows(assessmentsRes.data),
      invoices: asRows(invoicesRes.data),
      invoice_items: asRows(itemsRes.data),
      payments: asRows(paymentsRes.data),
      // v2: music metadata only; the underlying files stay in Storage and are
      // not part of the export file.
      music_library_items: asRows(musicRes.data),
      sheet_music_assignments: asRows(musicAssignmentsRes.data),
      events: asRows(eventsRes.data),
      event_students: asRows(eventStudentsRes.data),
      event_rsvps: asRows(eventRsvpsRes.data),
    },
  };
}

function withTeacherId(
  rows: Record<string, unknown>[],
  teacherId: string
): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row, teacher_id: teacherId }));
}

async function upsertAll(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<string | null> {
  if (rows.length === 0) return null;
  // Chunk to avoid payload limits
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) return `${table}: ${error.message}`;
  }
  return null;
}

/**
 * Restore a studio export into the current teacher's account.
 * Rows keep their original IDs; teacher_id is rewritten to the importer.
 * Existing rows with the same IDs are updated (upsert).
 */
export async function importStudioExport(
  supabase: SupabaseClient,
  teacherId: string,
  payload: StudioDataExport
): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }> {
  if (!payload || !SUPPORTED_IMPORT_VERSIONS.includes(payload.version)) {
    return {
      ok: false,
      error: `Unsupported export version (expected one of ${SUPPORTED_IMPORT_VERSIONS.join(", ")})`,
    };
  }
  if (!payload.tables || typeof payload.tables !== "object") {
    return { ok: false, error: "Invalid export: missing tables" };
  }

  const t = payload.tables;
  const counts: Record<string, number> = {};

  const steps: { name: string; rows: Record<string, unknown>[] }[] = [
    {
      name: "studio_policies",
      rows: t.studio_policies
        ? [{ ...t.studio_policies, teacher_id: teacherId }]
        : [],
    },
    { name: "guardians", rows: withTeacherId(t.guardians ?? [], teacherId) },
    { name: "students", rows: withTeacherId(t.students ?? [], teacherId) },
    { name: "plans", rows: withTeacherId(t.plans ?? [], teacherId) },
    { name: "lesson_slots", rows: withTeacherId(t.lesson_slots ?? [], teacherId) },
    { name: "lessons", rows: withTeacherId(t.lessons ?? [], teacherId) },
    { name: "attendance", rows: t.attendance ?? [] },
    { name: "lesson_notes", rows: t.lesson_notes ?? [] },
    { name: "student_plans", rows: t.student_plans ?? [] },
    { name: "practice_sessions", rows: t.practice_sessions ?? [] },
    { name: "note_attempts", rows: t.note_attempts ?? [] },
    { name: "flashcard_progress", rows: t.flashcard_progress ?? [] },
    {
      name: "skill_dimensions",
      rows: withTeacherId(t.skill_dimensions ?? [], teacherId),
    },
    { name: "skill_assessments", rows: t.skill_assessments ?? [] },
    { name: "invoices", rows: withTeacherId(t.invoices ?? [], teacherId) },
    { name: "invoice_items", rows: t.invoice_items ?? [] },
    { name: "payments", rows: t.payments ?? [] },
    // v2 tables; absent (empty) in v1 files
    {
      name: "music_library_items",
      rows: withTeacherId(t.music_library_items ?? [], teacherId),
    },
    { name: "sheet_music_assignments", rows: t.sheet_music_assignments ?? [] },
    { name: "events", rows: withTeacherId(t.events ?? [], teacherId) },
    { name: "event_students", rows: t.event_students ?? [] },
    { name: "event_rsvps", rows: t.event_rsvps ?? [] },
  ];

  for (const step of steps) {
    const err = await upsertAll(supabase, step.name, step.rows);
    if (err) return { ok: false, error: err };
    counts[step.name] = step.rows.length;
  }

  // Teacher profile subset (v2): only fill in a display name if the account
  // doesn't have one yet. Never touches entitlement or Stripe columns.
  const importedName = payload.teacher_profile?.display_name?.trim();
  if (importedName) {
    const { data: teacherRow } = await supabase
      .from("teachers")
      .select("display_name")
      .eq("id", teacherId)
      .maybeSingle();
    if (teacherRow && !(teacherRow.display_name as string | null)?.trim()) {
      await supabase
        .from("teachers")
        .update({ display_name: importedName })
        .eq("id", teacherId);
      counts.teacher_profile = 1;
    }
  }

  return { ok: true, counts };
}

export function parseExportPayload(raw: unknown): StudioDataExport | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as StudioDataExport;
  if (!SUPPORTED_IMPORT_VERSIONS.includes(obj.version)) return null;
  if (!obj.tables || typeof obj.tables !== "object") return null;
  return obj;
}
