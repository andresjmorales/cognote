/** Default chips offered when tagging a lesson plan. Teachers can add custom labels. */
export const DEFAULT_PLAN_LABELS = [
  "Easy",
  "Intermediate",
  "Advanced",
  "Fundamentals",
] as const;

export type DefaultPlanLabel = (typeof DEFAULT_PLAN_LABELS)[number];

/** Normalize labels: trim, drop empties, dedupe case-insensitively (keep first casing). */
export function normalizePlanLabels(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const label = item.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
