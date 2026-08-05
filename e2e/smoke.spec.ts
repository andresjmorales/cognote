import { test, expect } from "@playwright/test";
import { SEED, signInAsTeacher, studentListLink } from "./helpers/auth";

/**
 * Roadmap Playwright smoke: sign in · create student · assign (email + copy) ·
 * practice via token · portal seed · attendance + note.
 *
 * Needs a running app (`npm run dev`) and a healthy local Supabase with
 * `supabase/seed.sql` loaded (`npx supabase db reset --yes`). Credentials /
 * tokens: see that file and `e2e/helpers/auth.ts`. Seed teacher is hosted Pro
 * so free-tier student caps do not block create-student. If Auth returns `{}`
 * after reset, containers may still be 502 — restart with
 * `npx supabase stop && npx supabase start`. Headless Playwright does not
 * share your browser session; it signs in fresh each test.
 */
test.describe.configure({ mode: "serial" });

test.describe("CogNote core user flows", () => {
  test("1. sign in as seed teacher", async ({ page }) => {
    await signInAsTeacher(page);
    await expect(page).toHaveURL(/\/dashboard/);
    // Nav label only — dashboard also has "Students View all →".
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Students", exact: true })
    ).toBeVisible();
  });

  test("2. create student", async ({ page }) => {
    await signInAsTeacher(page);
    await page.goto("/students");

    const name = `E2E Student ${Date.now()}`;
    await page.getByPlaceholder("Student name").fill(name);
    await page.getByRole("button", { name: "Add Student" }).click();

    await expect(studentListLink(page, name)).toBeVisible();
    await studentListLink(page, name).click();
    await expect(page).toHaveURL(/\/students\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("3. assign lesson — copy link path + Copy Link control", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsTeacher(page);

    // Practice-only student (no family email) → assign falls back to copy/share.
    await page.goto("/students");
    const name = `E2E Assign ${Date.now()}`;
    await page.getByPlaceholder("Student name").fill(name);
    await page.getByRole("button", { name: "Add Student" }).click();
    await studentListLink(page, name).click();

    await page.getByRole("button", { name: "Assign Lesson" }).click();
    await page.getByRole("button", { name: SEED.plans.week1 }).click();

    const toast = page.locator("text=/assigned!/i").first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Link copied|Link shared|Link:/i);

    await expect(
      page.getByText(SEED.plans.week1, { exact: false }).first()
    ).toBeVisible();

    // Explicit Copy Link on the assignment row (roadmap: email + copy).
    const copyBtn = page
      .getByRole("button", { name: /^(Copy|Share) Link$/ })
      .first();
    await copyBtn.click();
    await expect(
      page.getByRole("button", { name: /Copied!|Shared/ }).first()
    ).toBeVisible();
  });

  test("4. assign lesson — family with email still gets assign toast", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsTeacher(page);

    // Emma already has Week 1; assign Bass Clef Intro (family email on file).
    // With EMAIL_PROVIDER=none the toast still reports assigned + copy fallback.
    await page.goto("/students");
    await studentListLink(page, SEED.students.emma).click();

    await page.getByRole("button", { name: "Assign Lesson" }).click();
    await page.getByRole("button", { name: SEED.plans.bassIntro }).click();

    await expect(page.locator("text=/assigned!/i").first()).toBeVisible();
  });

  test("5. practice via seed token", async ({ page }) => {
    await page.goto(`/practice/${SEED.practiceTokenEmma}`);
    await expect(page.getByText(`Hi ${SEED.students.emma}!`)).toBeVisible();
    await expect(page.getByText(SEED.plans.week1)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Quiz" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Free Practice" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Flashcards" })).toBeVisible();

    await page.getByRole("button", { name: "Start Quiz" }).click();
    await expect(page.getByText(/Question \d+ of \d+/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("6. open seeded family portal", async ({ page }) => {
    await page.goto(`/portal/${SEED.portalTokenJordan}`);
    await expect(page.getByText("Family Portal")).toBeVisible();
    await expect(page.getByText(/Welcome,/i)).toBeVisible();
    await expect(page.getByText(/Practice/i).first()).toBeVisible();
    // Seeded practice links for Emma / Liam
    await expect(
      page.getByRole("link", { name: /Practice/i }).first()
    ).toBeVisible();
  });

  test("7. teacher can copy portal link from Families", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsTeacher(page);
    await page.goto("/families");

    const copyPortal = page
      .getByRole("button", { name: /^(Copy|Share) Portal Link$/ })
      .first();
    await expect(copyPortal).toBeVisible();
    await copyPortal.click();
    await expect(
      page.getByRole("button", { name: /Copied!|Shared/ }).first()
    ).toBeVisible();
  });

  test("8. attendance + note on schedule", async ({ page }) => {
    await signInAsTeacher(page);
    await page.goto("/schedule");
    await expect(
      page.getByRole("button", { name: "Add One-off Lesson" })
    ).toBeVisible();

    // Prefer an unmarked seed lesson (Tue Emma/Liam, Wed Noah, Thu Sophia).
    // Week chrome uses links, not buttons, for prev/next.
    const unmarkedLesson = page
      .getByRole("button", {
        name: /^(Emma|Liam|Sophia|Noah)\b/,
      })
      .filter({ hasNotText: /Attended|cancelled|No-show/i })
      .first();

    if (!(await unmarkedLesson.isVisible().catch(() => false))) {
      for (let i = 0; i < 3; i++) {
        await page.getByRole("link", { name: "Next week" }).click();
        if (await unmarkedLesson.isVisible().catch(() => false)) {
          break;
        }
      }
    }

    await expect(unmarkedLesson).toBeVisible();
    await unmarkedLesson.click();

    await page.getByRole("button", { name: "Attended", exact: true }).click();

    const note = `E2E note ${Date.now()}: five-finger pattern hands separate.`;
    await page
      .getByPlaceholder("Shown in the family portal: practice this week…")
      .fill(note);
    await page.getByRole("button", { name: "Save Notes" }).click();

    // Modal stays open; note field keeps the text after save.
    await expect(
      page.getByPlaceholder("Shown in the family portal: practice this week…")
    ).toHaveValue(note);
  });
});
