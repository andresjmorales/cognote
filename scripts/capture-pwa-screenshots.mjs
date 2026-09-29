// Regenerates the manifest install screenshots (app/manifest.ts). Chrome's
// richer install UI needs one screenshot per form factor, 320-3840px a side,
// max:min ratio under 2.3, PNG/JPEG only.
//
// Usage: node scripts/capture-pwa-screenshots.mjs [baseUrl]
// Needs the app running (a production build, matching what users install) and
// a seeded Supabase, since it signs in as the seed teacher.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3000";

// Mirrors supabase/seed.sql, same credentials as e2e/helpers/auth.ts.
const SEED_TEACHER = { email: "teacher@example.com", password: "password123" };

// Keep these in sync with the `sizes` strings in app/manifest.ts.
const SHOTS = [
  { file: "dashboard-narrow.png", width: 412, height: 915, formFactor: "narrow" },
  { file: "dashboard-wide.png", width: 1280, height: 800, formFactor: "wide" },
];

const outDir = path.join(process.cwd(), "public", "screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);
    await page.getByPlaceholder("Email").fill(SEED_TEACHER.email);
    await page.getByPlaceholder("Password").fill(SEED_TEACHER.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/dashboard");
    await page.getByRole("button", { name: "Account menu" }).waitFor();
    // Let charts and fonts settle before the capture.
    await page.waitForTimeout(1000);
    const file = path.join(outDir, shot.file);
    await page.screenshot({ path: file });
    console.log(`${shot.file} ${shot.width}x${shot.height} (${shot.formFactor})`);
    await context.close();
  }
} finally {
  await browser.close();
}
