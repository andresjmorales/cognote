import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CACHE_EXCLUDED_PATTERN, isIosBrowser, PWA } from "./pwa";

describe("PWA constants", () => {
  it("has a short name that fits a home-screen label", () => {
    expect(PWA.shortName.length).toBeGreaterThan(0);
    expect(PWA.shortName.length).toBeLessThanOrEqual(12);
  });

  it("uses valid hex colours for the manifest", () => {
    for (const c of [PWA.themeColor, PWA.backgroundColor]) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("scopes the app to the site root", () => {
    expect(PWA.startUrl).toBe("/");
    expect(PWA.scope).toBe("/");
  });

  it("does not reuse the surface colour as the background (avoids a white flash)", () => {
    expect(PWA.backgroundColor).not.toBe(PWA.themeColor);
  });
});

describe("service worker cache policy", () => {
  it("never touches a per-session prefix, bare paths included", () => {
    for (const path of [
      "/api/notifications",
      "/api",
      "/auth/confirm",
      "/auth",
      "/portal/abc123",
      "/portal",
    ]) {
      expect(CACHE_EXCLUDED_PATTERN.test(path), path).toBe(true);
    }
  });

  it("leaves public routes alone", () => {
    for (const path of [
      "/",
      "/lessons",
      "/offline",
      "/icons/icon-192.png",
      "/students/portal-notes",
      "/help/offline-tips",
      "/api-key-settings",
    ]) {
      expect(CACHE_EXCLUDED_PATTERN.test(path), path).toBe(false);
    }
  });

  it("public/sw.js mirrors the pattern exactly (it cannot import this module)", () => {
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain(String(CACHE_EXCLUDED_PATTERN));
  });
});

describe("isIosBrowser", () => {
  // Real agents: iPhone and iPadOS desktop mode from developer.apple.com forums
  // #119186, the iPad token from the WebKit Safari 13 notes, and the rest from
  // the browsers themselves.
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const IPADOS_DESKTOP =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15";
  const IPAD_NARROW =
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const MACOS_SAFARI =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  const MACOS_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  it("recognises iPhone Safari and desktop-mode iPad Safari", () => {
    expect(
      isIosBrowser({
        userAgent: IPHONE_SAFARI,
        platform: "iPhone",
        maxTouchPoints: 5,
        hasStandaloneProperty: true,
      })
    ).toBe(true);
    expect(
      isIosBrowser({
        userAgent: IPADOS_DESKTOP,
        platform: "MacIntel",
        maxTouchPoints: 5,
        hasStandaloneProperty: true,
      })
    ).toBe(true);
  });

  it("recognises desktop-mode iPad from its Mac agent when navigator.standalone is absent", () => {
    expect(
      isIosBrowser({
        userAgent: IPADOS_DESKTOP,
        platform: "MacIntel",
        maxTouchPoints: 5,
        hasStandaloneProperty: false,
      })
    ).toBe(true);
  });

  it("recognises the iPad token that iPad mini and narrow Split View keep", () => {
    expect(
      isIosBrowser({
        userAgent: IPAD_NARROW,
        platform: "iPad",
        maxTouchPoints: 5,
        hasStandaloneProperty: false,
      })
    ).toBe(true);
  });

  it("keeps navigator.standalone as the backstop when agent and touch points say nothing", () => {
    expect(
      isIosBrowser({
        userAgent: MACOS_SAFARI,
        platform: "MacIntel",
        maxTouchPoints: 0,
        hasStandaloneProperty: true,
      })
    ).toBe(true);
  });

  it("rejects Macs, which report no touch points", () => {
    expect(
      isIosBrowser({
        userAgent: MACOS_SAFARI,
        platform: "MacIntel",
        maxTouchPoints: 0,
        hasStandaloneProperty: false,
      })
    ).toBe(false);
    expect(
      isIosBrowser({
        userAgent: MACOS_CHROME,
        platform: "MacIntel",
        maxTouchPoints: 0,
        hasStandaloneProperty: false,
      })
    ).toBe(false);
  });

  it("rejects touch devices that are not Apple", () => {
    expect(
      isIosBrowser({
        userAgent: ANDROID_CHROME,
        platform: "Linux armv8l",
        maxTouchPoints: 5,
        hasStandaloneProperty: false,
      })
    ).toBe(false);
  });
});
