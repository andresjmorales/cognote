import { test, expect, type Page } from "@playwright/test";
import { signInAsTeacher } from "./helpers/auth";

const MOBILE_WIDTHS = [320, 360, 375, 412];

function overflowOf(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

test.describe("mobile layout", () => {
  test("schedule has no horizontal overflow across mobile widths", async ({
    page,
  }) => {
    await signInAsTeacher(page);

    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/schedule");
      await expect(
        page.getByRole("heading", { name: "Schedule" })
      ).toBeVisible();

      const overflow = await overflowOf(page);
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        1
      );
    }
  });

  test("one-off lesson date input is labelled on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await signInAsTeacher(page);
    await page.goto("/schedule");

    await page.getByRole("button", { name: "Add One-off Lesson" }).click();
    await expect(page.getByLabel("Date")).toBeVisible();
  });

  test("long student names wrap without overflow", async ({ page }) => {
    const longName = `AlexandertheGreatLongnameExtraordinaire${Date.now()}`;
    let studentId: string | null = null;
    await page.setViewportSize({ width: 360, height: 812 });
    await signInAsTeacher(page);

    try {
      await page.goto("/students");
      await page.getByPlaceholder("Student name").fill(longName);
      await page.getByRole("button", { name: "Add Student" }).click();
      const studentLink = page.getByRole("link", {
        name: new RegExp(`^${longName}\\b`),
      });
      await expect(studentLink).toBeVisible();
      studentId = (await studentLink.getAttribute("href"))
        ?.split("/")
        .filter(Boolean)
        .pop() ?? null;

      // Match the studio's weekday, not the browser's: the slot's start_date
      // is the studio-timezone today, so a wrong weekday can schedule the
      // lesson next week and the card never appears.
      const policy = await (
        await page.request.get("/api/settings/policy")
      ).json();
      const todayLabel = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: policy.timezone ?? "America/Chicago",
      }).format(new Date());

      await page.goto("/schedule");
      await page.getByRole("button", { name: "Add Slot" }).click();
      const form = page
        .locator("form")
        .filter({ has: page.getByRole("button", { name: "Add Slot" }) });
      await form.locator("select").nth(0).selectOption({ label: longName });
      await form.locator("select").nth(1).selectOption({ label: todayLabel });
      await page.getByRole("button", { name: "Add Slot" }).last().click();

      // Wait for the refreshed schedule (slot row + lesson card) before
      // measuring, otherwise the row under test has not rendered yet.
      const lessonButton = page
        .getByRole("button", { name: new RegExp(longName) })
        .first();
      await expect(lessonButton).toBeVisible();

      const overflow = await overflowOf(page);
      expect(overflow, "slot row overflow").toBeLessThanOrEqual(1);

      // The lesson modal must keep the long name inside the viewport.
      await lessonButton.click();
      const heading = page.getByRole("heading", { level: 3, name: longName });
      await expect(heading).toBeVisible();
      const box = await heading.boundingBox();
      if (!box) throw new Error("lesson heading has no layout box");
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);
    } finally {
      if (studentId) {
        await page.request
          .delete(`/api/students/${studentId}`)
          .catch(() => undefined);
      }
    }
  });
});
