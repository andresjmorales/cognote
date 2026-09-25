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
});
