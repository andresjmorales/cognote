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
      error: "No AI provider configured. Add a key in Settings → Optional AI.",
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
    if (args.provider === "openai") {
      return await callOpenAi(args.apiKey, prompt);
    }
    return await callAnthropic(args.apiKey, prompt);
  } catch (err) {
    return {
      mapping: {},
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

async function callOpenAi(
  apiKey: string,
  prompt: string
): Promise<{ mapping: ColumnMapping; error?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You return only JSON column mappings for spreadsheet import.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      mapping: {},
      error: `OpenAI error (${res.status}): ${text.slice(0, 200)}`,
    };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return { mapping: parseMappingJson(content) };
}

async function callAnthropic(
  apiKey: string,
  prompt: string
): Promise<{ mapping: ColumnMapping; error?: string }> {
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
      mapping: {},
      error: `Anthropic error (${res.status}): ${text.slice(0, 200)}`,
    };
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text =
    data.content?.find((c) => c.type === "text")?.text ?? "{}";
  return { mapping: parseMappingJson(text) };
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
