import { devices, expect, test, type Page } from "@playwright/test";

import { signInAsTeacher } from "./helpers/auth";

// The service worker registers in production only
// (components/pwa/ServiceWorkerRegistrar.tsx), so the worker tests need a prod build:
//   npm run build && npm run start
//   PWA_E2E=1 npm run test:e2e
// Without PWA_E2E they skip with that message instead of hanging for 60s on
// navigator.serviceWorker.ready. The policy itself is unit-tested in lib/pwa.test.ts.
const prodBuild = process.env.PWA_E2E === "1";
const prodOnly =
  "service worker registers in production only — run against `next start` with PWA_E2E=1 (see CONTRIBUTING.md)";

/** Load `/` and wait until the page is actually controlled by /sw.js —
 *  `serviceWorker.ready` can resolve before clients.claim() lands. */
async function gotoControlled(page: Page) {
  await page.goto("/");
  const controlled = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return Boolean(navigator.serviceWorker.controller);
  });
  expect(controlled, "page not controlled by the service worker").toBe(true);
}

test("serves an installable manifest", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect(
    manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable"),
    "manifest must ship a maskable icon or Android clips the artwork"
  ).toBe(true);

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("serves sw.js and manifest without an auth redirect", async ({ request }) => {
  for (const path of ["/sw.js", "/manifest.webmanifest"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
});

test("registers a service worker", async ({ page }) => {
  test.skip(!prodBuild, prodOnly);
  await page.goto("/");
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, script: reg.active?.scriptURL ?? null };
  });
  expect(sw?.script?.endsWith("/sw.js"), "wrong worker registered").toBe(true);
  expect(sw?.scope).toBe(`${new URL(page.url()).origin}/`);
});

test("serves the offline page when offline", async ({ page, context }) => {
  test.skip(!prodBuild, prodOnly);
  await gotoControlled(page);
  await context.setOffline(true);
  // The SW serves the cached /offline body for the requested URL without a
  // redirect, so the document URL stays /lessons — assert the rendered content,
  // not the URL (an /offline URL assertion would fail on correct behaviour).
  await page.goto("/lessons").catch(() => {});
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});

test("never caches API, auth, or portal responses", async ({ page }) => {
  test.skip(!prodBuild, prodOnly);
  await gotoControlled(page);

  // Exercise the excluded paths FROM INSIDE THE PAGE so the requests traverse
  // the service worker — Playwright's request fixture runs in Node and bypasses it.
  await page.evaluate(() => fetch("/api/notifications").catch(() => {}));
  await page.goto("/portal/__probe__").catch(() => {});

  const cachedPaths = await page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
  // Positive control: the precached icon proves the worker installed and this
  // enumeration is reading real entries, so an empty cache can't read as a pass.
  expect(cachedPaths).toContain("/icons/icon-192.png");
  expect(cachedPaths.filter((p) => /^\/(api|auth|portal)(?:\/|$)/.test(p))).toEqual([]);
});

test("does not serve the offline shell for /api, /auth or /portal", async ({
  page,
  context,
}) => {
  test.skip(!prodBuild, prodOnly);
  await gotoControlled(page);
  await context.setOffline(true);

  // Excluded routes must fail outright rather than fall back to /offline, so
  // the previous document stays in place — checked before the positive control
  // below, which is what replaces it with the offline page.
  for (const path of ["/portal/__probe__", "/auth/confirm"]) {
    await page.goto(path).catch(() => {});
    await expect(page.getByRole("heading", { name: /offline/i }), path).toHaveCount(0);
  }

  // A non-excluded route does get the shell, which also proves we were offline.
  await page.goto("/lessons").catch(() => {});
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});

/** iOS is the only platform with a custom install affordance left: there is no
 *  beforeinstallprompt there, so the Share sheet is the only path. */
test.describe("iOS install hint", () => {
  // devices[...] spread would drag in defaultBrowserType, which Playwright
  // refuses inside a describe group.
  const iphone = devices["iPhone 13"];
  test.use({
    userAgent: iphone.userAgent,
    viewport: iphone.viewport,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
  });

  test("shows the Share-sheet hint and remembers a dismissal", async ({ page }) => {
    await signInAsTeacher(page);
    const openAccountMenu = () =>
      page.getByRole("button", { name: "Account menu" }).click();

    await openAccountMenu();
    const hint = page.getByText(/Add to Home Screen/i);
    await expect(hint).toBeVisible();

    await page.getByRole("button", { name: "Dismiss install instructions" }).click();
    await expect(hint).toHaveCount(0);

    await page.reload();
    await openAccountMenu();
    await expect(page.getByText(/Add to Home Screen/i)).toHaveCount(0);
  });
});
