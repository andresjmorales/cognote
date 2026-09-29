// Bump this on every release that changes the shell so clients pick it up.
const CACHE = "cognote-shell-v1";
const OFFLINE_URL = "/offline";
// The offline page is self-contained, so only it and the home-screen icon are
// needed for a correct cold first offline render.
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch dynamic, authenticated, or API traffic.
  if (/^\/(api|auth|portal)\//.test(url.pathname)) return;

  // Navigations: network only, offline page on failure. Do NOT cache HTML —
  // it can contain family/studio data and must not persist on a device.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // Immutable build assets: cache-first, with an explicit error path so an
  // uncached asset while offline degrades to a network error (not a rejection).
  // /sw.js is excluded — the worker must never serve itself from cache.
  if (
    url.pathname !== "/sw.js" &&
    (url.pathname.startsWith("/_next/static/") ||
      /\.(?:css|js|woff2?|png|svg|webp)$/.test(url.pathname))
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            // Only cache successful responses — never a 404/500.
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
