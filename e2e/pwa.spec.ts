import { expect, test } from "@playwright/test";

test("serves an installable manifest", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test("serves sw.js and manifest without an auth redirect", async ({ request }) => {
  for (const path of ["/sw.js", "/manifest.webmanifest"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
});

test("registers a service worker", async ({ page }) => {
  await page.goto("/");
  const scope = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(scope).toBeTruthy();
});

test("serves the offline page when offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  // The SW serves the cached /offline body for the requested URL without a
  // redirect, so the document URL stays /lessons — assert the rendered content,
  // not the URL (an /offline URL assertion would fail on correct behaviour).
  await page.goto("/lessons").catch(() => {});
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});

test("never caches API, auth, or portal responses", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker?.ready);

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
  expect(cachedPaths.filter((p) => /^\/(api|auth|portal)\//.test(p))).toEqual([]);
});
