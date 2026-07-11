import { describe, expect, it } from "vitest";
import { findIndexedResult, searchStaticIndexes } from "./music-sources";

describe("music-sources search", () => {
  it("finds Mutopia Bach results that are importable", () => {
    const results = searchStaticIndexes("bach", ["mutopia"]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.source === "mutopia")).toBe(true);
    const importable = results.filter((r) => r.import_allowed);
    expect(importable.length).toBeGreaterThan(0);
    expect(importable.every((r) => r.file_url?.endsWith(".pdf"))).toBe(true);
    expect(importable[0].format).toBe("pdf");
    expect(importable[0].file_url).toMatch(/mutopiaproject\.org\/ftp\/.+\.pdf$/);
  });

  it("excludes CC BY-SA from import_allowed", () => {
    const results = searchStaticIndexes("a", ["mutopia"]).filter(
      (r) => r.license_code === "cc_by_sa"
    );
    // May be empty if query too short — use empty-filter on full index via find
    const sa = searchStaticIndexes("danube", ["mutopia"]).filter(
      (r) => r.license_code === "cc_by_sa"
    );
    for (const r of sa) {
      expect(r.import_allowed).toBe(false);
    }
  });

  it("finds OpenScore Lieder as link-only CC0", () => {
    const results = searchStaticIndexes("mahler", ["openscore-lieder"]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].license_code).toBe("cc0");
    expect(results[0].import_allowed).toBe(false);
    expect(results[0].source_url).toContain("musescore.com");
  });

  it("looks up indexed Mutopia ids", () => {
    const sample = searchStaticIndexes("beethoven", ["mutopia"]).find(
      (r) => r.import_allowed && r.file_url?.endsWith(".pdf")
    );
    expect(sample).toBeTruthy();
    expect(sample!.file_url).toMatch(/mutopiaproject\.org\/ftp\/.+\.pdf$/);
    const found = findIndexedResult(sample!.id);
    expect(found?.title).toBe(sample!.title);
  });
});
