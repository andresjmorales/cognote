import { describe, expect, it } from "vitest";
import {
  buildMetadataSuggestions,
  composerSuggestionsFrom,
} from "./music-metadata-suggest";

describe("composerSuggestionsFrom", () => {
  const rows = [
    "Bach, Johann Sebastian (1685–1750)",
    "J. S. Bach (1685–1750)",
    "Bacharach, Burt",
    "Satie, Erik",
  ];

  it("matches either spelling and normalizes the result", () => {
    const names = composerSuggestionsFrom(rows, "bach").map((s) => s.composer);
    expect(names).toContain("Johann Sebastian Bach");
    expect(names).toContain("J. S. Bach");
    expect(names).toContain("Burt Bacharach");
    expect(names).not.toContain("Erik Satie");
  });

  it("fills only the composer field", () => {
    const [first] = composerSuggestionsFrom(rows, "satie");
    expect(first.composer).toBe("Erik Satie");
    expect(first.title).toBe("");
    expect(first.tags).toEqual([]);
  });

  it("ignores queries shorter than two characters", () => {
    expect(composerSuggestionsFrom(rows, "b")).toEqual([]);
  });
});

describe("buildMetadataSuggestions", () => {
  it("suggests catalogue works from a partial title", () => {
    const results = buildMetadataSuggestions("title", "french suite");
    expect(results.length).toBeGreaterThan(0);
    const bach = results.find((r) => r.title.includes("French Suite"));
    expect(bach?.composer).toBe("J. S. Bach");
    expect(bach?.tags).toContain("baroque");
  });

  it("collapses the same work appearing twice", () => {
    const results = buildMetadataSuggestions("title", "french suite", 6);
    const keys = results.map((r) => `${r.title}|${r.composer}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ignores instrumentation-only matches", () => {
    const results = buildMetadataSuggestions("title", "fren");
    expect(results.length).toBeGreaterThan(0);
    // "French horn" parts must not answer a title lookup for "fren".
    expect(
      results.every((r) => /fren/i.test(`${r.title} ${r.composer}`))
    ).toBe(true);
  });

  it("caps the list and skips short queries", () => {
    expect(buildMetadataSuggestions("title", "bach", 4).length).toBe(4);
    expect(buildMetadataSuggestions("title", "b")).toEqual([]);
  });
});
