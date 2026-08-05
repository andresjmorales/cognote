import type { Page } from "@playwright/test";

/** Local seed teacher from supabase/seed.sql */
export const SEED_TEACHER = {
  email: "teacher@example.com",
  password: "password123",
} as const;

export const SEED = {
  practiceTokenEmma: "dev-token-emma-week1",
  practiceTokenNoahSymbols: "dev-token-noah-symbols",
  practiceTokenMayaKeys: "dev-token-maya-keys",
  portalTokenJordan: "dev-portal-jordan",
  portalTokenNoah: "dev-portal-noah",
  students: {
    emma: "Emma",
    liam: "Liam",
    sophia: "Sophia",
    noah: "Noah",
    maya: "Maya",
  },
  plans: {
    week1: "Week 1 — Middle C Position",
    bassIntro: "Bass Clef Intro",
    symbols: "Dynamics & Tempo Terms",
    keySignatures: "Major Key Signatures",
  },
} as const;

export async function signInAsTeacher(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(SEED_TEACHER.email);
  await page.getByPlaceholder("Password").fill(SEED_TEACHER.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  // Fail fast with the on-page error (empty "{}" often means Auth/Kong 502
  // right after db reset — restart local Supabase and retry).
  try {
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
  } catch (err) {
    const authError = (
      await page.locator("form p.text-error, form p.text-red-500, main p").allTextContents()
    )
      .map((t) => t.trim())
      .filter(Boolean)
      .join(" | ");
    throw new Error(
      `Sign-in did not reach /dashboard.${authError ? ` UI: ${authError}` : ""} ` +
        "If you just ran db reset and saw a 502, run: npx supabase stop && npx supabase start",
      { cause: err }
    );
  }
}

/** Student list cards include family/age/session text in the accessible name. */
export function studentListLink(page: Page, studentName: string) {
  return page.getByRole("link", {
    name: new RegExp(`^${escapeRegExp(studentName)}\\b`),
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
