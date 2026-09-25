import { test, expect } from "@playwright/test";
import { signInAsTeacher } from "./helpers/auth";

const MOBILE_WIDTHS = [320, 360, 375, 412];

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

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
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
    await page.setViewportSize({ width: 360, height: 812 });
    await signInAsTeacher(page);

    await page.goto("/students");
    await page.getByPlaceholder("Student name").fill(longName);
    await page.getByRole("button", { name: "Add Student" }).click();
    await expect(
      page.getByRole("link", { name: new RegExp(`^${longName}\\b`) })
    ).toBeVisible();

    const todayLabel = await page.evaluate(() =>
      new Date().toLocaleDateString("en-US", { weekday: "long" })
    );

    await page.goto("/schedule");
    await page.getByRole("button", { name: "Add Slot" }).click();
    const form = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Add Slot" }) });
    await form.locator("select").nth(0).selectOption({ label: longName });
    await form.locator("select").nth(1).selectOption({ label: todayLabel });
    await page.getByRole("button", { name: "Add Slot" }).last().click();

    // The slot row must not widen the page.
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow, "slot row overflow").toBeLessThanOrEqual(1);

    // The lesson modal must keep the long name inside the viewport.
    const lessonButton = page
      .getByRole("button", { name: new RegExp(longName) })
      .first();
    await expect(lessonButton).toBeVisible();
    await lessonButton.click();

    const heading = page.getByRole("heading", { level: 3, name: longName });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    if (!box) throw new Error("lesson heading has no layout box");
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);
  });
});
