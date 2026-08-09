import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Zod schemas for the highest-traffic mutation routes. Unknown fields are
 * stripped; sizes are bounded so unvalidated JSON can't land in the DB.
 * Optional fields mirror the partial-update behavior of the routes
 * (supabase-js drops undefined values from updates).
 */

export function parseBody<S extends z.ZodType>(
  schema: S,
  raw: unknown
): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const message = issue
    ? `${issue.path.join(".") || "body"}: ${issue.message}`
    : "Invalid request body";
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status: 400 }),
  };
}

const trimmedName = z.string().trim().min(1, "Name is required").max(200);
const optionalText = (max: number) => z.string().max(max).nullable().optional();
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
/** UI clears dates by sending "" or null. */
const optionalDate = z.union([dateString, z.literal(""), z.null()]).optional();
const optionalUuid = z.union([z.uuid(), z.literal(""), z.null()]).optional();

// ── Students ────────────────────────────────────────────────────────────────

export const studentCreateSchema = z.object({
  name: trimmedName,
  birthdate: optionalDate,
  level: optionalText(120),
  teacherNotes: optionalText(50_000),
  guardianId: optionalUuid,
  contactEmail: optionalText(254),
  contactPhone: optionalText(50),
  contactName: optionalText(200),
  adultSelf: z.boolean().optional(),
});

export const studentUpdateSchema = z.object({
  name: trimmedName.optional(),
  parentContact: optionalText(500),
  guardianId: optionalUuid,
  level: optionalText(120),
  birthdate: optionalDate,
  practiceStartDate: optionalDate,
  defaultRateCents: z
    .union([z.number().min(0).max(10_000_000), z.string().max(20), z.null()])
    .optional(),
  archived: z.boolean().optional(),
});

// ── Families / guardians ────────────────────────────────────────────────────

const emailRecipients = z
  .enum(["primary", "secondary", "both"])
  .optional()
  .catch(undefined);

const newStudentsList = z
  .array(
    z.object({
      name: z.string().max(200),
      birthdate: optionalDate,
    })
  )
  .max(50)
  .optional();

export const guardianCreateSchema = z.object({
  name: trimmedName,
  familyName: optionalText(200),
  email: optionalText(254),
  phone: optionalText(50),
  secondaryName: optionalText(200),
  secondaryEmail: optionalText(254),
  secondaryPhone: optionalText(50),
  emailRecipients,
  studentIds: z.array(z.uuid()).max(200).optional(),
  newStudents: newStudentsList,
});

export const guardianUpdateSchema = guardianCreateSchema.partial();

// ── Practice plans ──────────────────────────────────────────────────────────

const planFields = z.object({
  name: trimmedName,
  isTemplate: z.boolean().optional(),
  planType: z
    .enum(["note_identification", "key_signature_identification", "symbol_concepts"])
    .optional(),
  clef: z.enum(["treble", "bass", "both"]).optional(),
  keySignature: z.string().max(40).optional(),
  includeSharps: z.boolean().optional(),
  includeFlats: z.boolean().optional(),
  includeChords: z.boolean().optional(),
  measuresShown: z.number().int().min(1).max(2).optional(),
  questionsPerLesson: z.number().int().min(5).max(30).optional(),
  answerChoices: z.number().int().min(2).max(7).optional(),
  notes: z.array(z.string().max(10)).max(300).optional(),
  symbols: z.array(z.record(z.string(), z.unknown())).max(300).optional(),
  keySigScaleMode: z.enum(["major", "minor", "both"]).optional(),
  keySignatures: z.array(z.string().max(40)).max(60).optional(),
  labels: z.array(z.string().max(60)).max(30).optional(),
  teacherNotes: z.string().max(20_000).optional(),
  showHints: z.boolean().optional(),
  timeLimitSeconds: z.number().int().min(0).max(600).optional(),
});

export const planCreateSchema = planFields;
export const planUpdateSchema = planFields.partial();

// ── Flashcard reviews (public token route) ──────────────────────────────────

export const flashcardReviewSchema = z
  .object({
    itemType: z.enum(["note", "symbol", "key_signature"]).catch("note").optional(),
    itemId: z.string().max(120).optional(),
    /** Legacy payload field. */
    note: z.string().max(120).optional(),
    clef: z.string().max(20).nullable().optional(),
    easeFactor: z.number().min(1).max(10),
    intervalDays: z.number().int().min(0).max(36_500),
    repetitions: z.number().int().min(0).max(1_000_000),
    nextReview: z
      .string()
      .max(64)
      .refine((v) => !Number.isNaN(Date.parse(v)), "Expected a valid timestamp"),
  })
  .refine((v) => Boolean(v.itemId ?? v.note), {
    message: "itemId is required",
  });
