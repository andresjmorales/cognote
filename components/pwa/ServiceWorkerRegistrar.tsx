"use client";

import { useEffect } from "react";

/** Dev only: a worker left over from a previous `next start` keeps intercepting
 *  navigations and serving its caches until every client unloads, so tear it
 *  down instead of just skipping registration. */
async function clearPwaState() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("cognote-shell"))
      .map((key) => caches.delete(key))
  );
}

/** Registers /sw.js in production only. Dev keeps a clean window for HMR. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void clearPwaState().catch(() => {});
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
