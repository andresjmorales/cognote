import { describe, expect, it } from "vitest";
import { PWA } from "./pwa";

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
