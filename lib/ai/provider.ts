import type { ColumnMapping, ImportField } from "@/lib/spreadsheet-import";
import { IMPORT_FIELDS } from "@/lib/spreadsheet-import";

export type AiProviderId = "none" | "openai" | "anthropic";

/**
 * Ask an LLM to map spreadsheet headers → CogNote import fields.
 * Teacher BYO key only; never uses platform keys.
 */
export async function suggestMappingWithAi(args: {
  provider: AiProviderId;
  apiKey: string;
  headers: string[];
  sampleRows: Record<string, string>[];
}): Promise<{ mapping: ColumnMapping; error?: string }> {
  if (args.provider === "none" || !args.apiKey.trim()) {
    return {
      mapping: {},
      error: "No AI provider configured. Add a key in Account settings → Optional AI.",
    };
  }

  const fieldList = IMPORT_FIELDS.join(", ");
  const sample = args.sampleRows.slice(0, 5);
  const prompt = `You map spreadsheet columns for a music-teacher studio CRM.

Target fields (use these exact keys, or null if no column fits):
${fieldList}

Headers: ${JSON.stringify(args.headers)}
Sample rows: ${JSON.stringify(sample)}

Return ONLY valid JSON object: { "student_name": "Exact Header", ... }
Use the exact header strings from Headers. Omit or null unused fields.
Prefer student_name for the learner; guardian_name/email/phone for the parent.`;

  try {
    const content =
      args.provider === "openai"
        ? await callOpenAiText(args.apiKey, {
            system: "You return only JSON column mappings for spreadsheet import.",
            prompt,
            jsonObject: true,
          })
        : await callAnthropicText(args.apiKey, prompt);
    if (content.error) {
      return { mapping: {}, error: content.error };
    }
    return { mapping: parseMappingJson(content.text ?? "{}") };
  } catch (err) {
    return {
      mapping: {},
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

export type StudentSummaryContext = {
  name: string;
  /** Precomputed age in whole years; use this — do not recalculate from birthdate. */
  ageYears: number | null;
  level: string | null;
  /** Human label e.g. "since 2022" / "since Jan 15, 2024"; null if unknown. */
  practiceSinceLabel: string | null;
  /** Exact title date line to use, e.g. "July 13, 2026". */
  noteDateLabel: string;
  existingPrivateNotes: string | null;
  skills: { dimension: string; rating: number; assessedAt: string }[];
  attendance: {
    attended: number;
    studentCancel: number;
    teacherCancel: number;
    noShow: number;
    unmarked: number;
  };
  practice: {
    totalSessions: number;
    overallAccuracy: number | null;
    weakItems: { label: string; accuracy: number; attempts: number }[];
  };
  recentLessonNotes: {
    date: string;
    familyNote: string | null;
    privateNote: string | null;
  }[];
};

/**
 * Draft a concise progress summary for a student from studio data.
 * Teacher always edits before saving; BYO key only.
 */
export async function draftStudentSummaryWithAi(args: {
  provider: AiProviderId;
  apiKey: string;
  context: StudentSummaryContext;
}): Promise<{ summary: string; error?: string }> {
  if (args.provider === "none" || !args.apiKey.trim()) {
    return {
      summary: "",
      error: "No AI provider configured. Add a key in Account settings → Optional AI.",
    };
  }

  const ageLine =
    args.context.ageYears != null
      ? `Age is ${args.context.ageYears} (already computed — never recalculate or invent a different age).`
      : "Age is unknown (no birthdate).";

  const prompt = `You write a short private progress note for a music teacher about one student.

Hard rules:
- Start with exactly this H1 title (copy verbatim):
  # Progress Note — ${args.context.noteDateLabel}
- Then optionally a short subtitle with the student's first name only (not another date).
- ${ageLine}
- Use only facts in the JSON below. Do not invent repertoire, grades, milestones, "target ages," readiness timelines, or decisions about continuing/stopping lessons.
- Age is demographic context only — never turn it into a progress goal or deadline.
- If attendance or practice data is empty/zero, say that briefly in one sentence. Do not invent a data-collection roadmap.
- Prefer concrete observations from recentLessonNotes, skills, and practice weakItems when present.
- Write in GitHub-flavored markdown using only: paragraphs, **bold**, *italic*, ### headings, and - or 1. lists when useful.
- Keep it to 2–4 short sections after the title. Tone: warm, professional, teacher-to-self.
- This note will be appended under older notes — do not repeat long history already in existingPrivateNotes; focus on current status.

Student data:
${JSON.stringify(
  {
    name: args.context.name,
    ageYears: args.context.ageYears,
    level: args.context.level,
    practiceSinceLabel: args.context.practiceSinceLabel,
    skills: args.context.skills,
    attendance: args.context.attendance,
    practice: args.context.practice,
    recentLessonNotes: args.context.recentLessonNotes,
    existingPrivateNotesExcerpt: args.context.existingPrivateNotes
      ? args.context.existingPrivateNotes.slice(0, 800)
      : null,
  },
  null,
  2
)}`;

  try {
    const content =
      args.provider === "openai"
        ? await callOpenAiText(args.apiKey, {
            system:
              "You draft concise private piano-teacher progress notes as markdown. Obey age and title instructions exactly. Never invent milestones from age.",
            prompt,
            jsonObject: false,
          })
        : await callAnthropicText(args.apiKey, prompt);
    if (content.error) {
      return { summary: "", error: content.error };
    }
    const summary = ensureProgressNoteTitle(
      (content.text ?? "").trim(),
      args.context.noteDateLabel
    );
    return { summary };
  } catch (err) {
    return {
      summary: "",
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

/** Guarantee the dated H1 so stacked notes stay scannable. */
export function ensureProgressNoteTitle(
  markdown: string,
  noteDateLabel: string
): string {
  const expected = `# Progress Note — ${noteDateLabel}`;
  const trimmed = markdown.trim();
  if (!trimmed) return expected;
  if (/^#\s*Progress Note\b/i.test(trimmed)) {
    return trimmed.replace(/^#\s*Progress Note[^\n]*/i, expected);
  }
  return `${expected}\n\n${trimmed}`;
}

async function callOpenAiText(
  apiKey: string,
  args: { system: string; prompt: string; jsonObject: boolean }
): Promise<{ text?: string; error?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: args.jsonObject ? 0 : 0.4,
      ...(args.jsonObject
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      error: `OpenAI error (${res.status}): ${text.slice(0, 200)}`,
    };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

async function callAnthropicText(
  apiKey: string,
  prompt: string
): Promise<{ text?: string; error?: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      error: `Anthropic error (${res.status}): ${text.slice(0, 200)}`,
    };
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text =
    data.content?.find((c) => c.type === "text")?.text ?? "";
  return { text };
}

function parseMappingJson(raw: string): ColumnMapping {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object") return {};
  const obj = parsed as Record<string, unknown>;
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    const v = obj[field];
    if (typeof v === "string" && v.trim()) {
      mapping[field as ImportField] = v.trim();
    } else {
      mapping[field as ImportField] = null;
    }
  }
  return mapping;
}
