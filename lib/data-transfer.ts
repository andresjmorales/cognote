import type { SupabaseClient } from "@supabase/supabase-js";

export const DATA_EXPORT_VERSION = 1 as const;

export type StudioDataExport = {
  version: typeof DATA_EXPORT_VERSION;
  exportedAt: string;
  teacherId: string;
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
  };
};

function asRows(data: unknown): Record<string, unknown>[] {
  return (data as Record<string, unknown>[] | null) ?? [];
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
  ] = await Promise.all([
    supabase.from("studio_policies").select("*").eq("teacher_id", teacherId).maybeSingle(),
    supabase.from("guardians").select("*").eq("teacher_id", teacherId),
    supabase.from("students").select("*").eq("teacher_id", teacherId),
    supabase.from("plans").select("*").eq("teacher_id", teacherId),
    supabase.from("lesson_slots").select("*").eq("teacher_id", teacherId),
    supabase.from("lessons").select("*").eq("teacher_id", teacherId),
    supabase.from("skill_dimensions").select("*").eq("teacher_id", teacherId),
    supabase.from("invoices").select("*").eq("teacher_id", teacherId),
  ]);

  const students = asRows(studentsRes.data);
  const studentIds = students.map((s) => s.id as string);
  const lessonIds = asRows(lessonsRes.data).map((l) => l.id as string);
  const planIds = asRows(plansRes.data).map((p) => p.id as string);
  const dimensionIds = asRows(dimensionsRes.data).map((d) => d.id as string);
  const invoiceIds = asRows(invoicesRes.data).map((i) => i.id as string);

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
    tables: {
      studio_policies: (policyRes.data as Record<string, unknown> | null) ?? null,
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
  if (!payload || payload.version !== DATA_EXPORT_VERSION) {
    return {
      ok: false,
      error: `Unsupported export version (expected ${DATA_EXPORT_VERSION})`,
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
  ];

  for (const step of steps) {
    const err = await upsertAll(supabase, step.name, step.rows);
    if (err) return { ok: false, error: err };
    counts[step.name] = step.rows.length;
  }

  return { ok: true, counts };
}

export function parseExportPayload(raw: unknown): StudioDataExport | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as StudioDataExport;
  if (obj.version !== DATA_EXPORT_VERSION) return null;
  if (!obj.tables || typeof obj.tables !== "object") return null;
  return obj;
}
