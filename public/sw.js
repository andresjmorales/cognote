// Bump when the precache list or /offline changes: activate() drops every other
// cache name, which is what evicts the previous shell.
const CACHE = "cognote-shell-v2";
const OFFLINE_URL = "/offline";
// The offline page is self-contained, so only it and the home-screen icon are
// needed for a correct cold first offline render.
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
// Mirrored in lib/pwa.ts as CACHE_EXCLUDED_PATTERN (lib/pwa.test.ts keeps them in sync).
const EXCLUDED = /^\/(api|auth|portal)(?:\/|$)/;

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
  if (EXCLUDED.test(url.pathname)) return;

  // Navigations only. Assets are left to the HTTP cache (/_next/static is
  // immutable): caching them here would accumulate one copy per deploy with
  // nothing to evict, and they are unreachable offline anyway because HTML is
  // never cached.
  if (request.mode !== "navigate") return;

  // Network first, cached /offline on failure. Do NOT cache HTML — it can
  // contain family/studio data and must not persist on a device. fetch() only
  // rejects on a network failure, so a 4xx/5xx or an auth redirect is passed
  // through untouched.
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
    )
  );
});

// Web push. The payload is the JSON written by lib/server/push.ts. A push MUST
// always end in a shown notification: subscriptions are created with
// userVisibleOnly, and Safari revokes a subscription that receives pushes
// without displaying anything.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // The payload's id (carried as `tag`) means a re-delivery of the same
  // notification REPLACES its own tray entry instead of stacking a duplicate.
  // Only set it when present: an explicit undefined tag is not the same as no
  // tag on some clients.
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { href: data.href || "/" },
  };
  if (data.tag) options.tag = data.tag;
  // The event time, when the payload carries a usable one: the tray would
  // otherwise show when the push ARRIVED, which misreports a delivery delayed
  // up to the TTL. A non-finite/absent value is ignored, leaving the default.
  if (Number.isFinite(data.timestamp)) options.timestamp = data.timestamp;
  event.waitUntil(
    self.registration.showNotification(data.title || "CogNote", options)
  );
});

// Focus an existing tab already on the target route, otherwise open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  const target = new URL(href, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
