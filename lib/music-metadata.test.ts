import { describe, expect, it } from "vitest";
import {
  applySuggestion,
  filenameToQuery,
  normalizeComposer,
  suggestionTags,
  type MetadataSuggestion,
  type UploadMetadata,
} from "./music-metadata";

describe("normalizeComposer", () => {
  it("strips catalogue life dates", () => {
    expect(normalizeComposer("J. S. Bach (1685–1750)")).toBe("J. S. Bach");
    expect(normalizeComposer("Florence Price (b. 1887)")).toBe("Florence Price");
  });

  it("flips surname-first filing order", () => {
    expect(normalizeComposer("Abbott, Jane Bingham")).toBe("Jane Bingham Abbott");
    expect(normalizeComposer("Bach, Johann Sebastian (1685-1750)")).toBe(
      "Johann Sebastian Bach"
    );
  });

  it("keeps generational suffixes and plain names intact", () => {
    expect(normalizeComposer("Bach, Jr.")).toBe("Bach, Jr.");
    expect(normalizeComposer("  Erik   Satie ")).toBe("Erik Satie");
  });

  it("keeps a parenthetical that is not a date", () => {
    expect(normalizeComposer("Anonymous (Trad.)")).toBe("Anonymous (Trad.)");
  });
});

describe("suggestionTags", () => {
  it("splits instrumentation and appends the period", () => {
    expect(
      suggestionTags({ instrument: "Harpsichord, Piano", style: "Baroque" })
    ).toEqual(["harpsichord", "piano", "baroque"]);
  });

  it("dedupes and tolerates missing fields", () => {
    expect(suggestionTags({ instrument: "Piano; piano" })).toEqual(["piano"]);
    expect(suggestionTags({})).toEqual([]);
  });
});

describe("filenameToQuery", () => {
  it("turns a filename into searchable words", () => {
    expect(filenameToQuery("bwv814_french-suite-3.pdf")).toBe(
      "bwv814 french suite 3"
    );
  });

  it("drops track numbers, copy markers and directories", () => {
    expect(filenameToQuery("/scores/03 - Gymnopedie No.1 (2).mxl")).toBe(
      "Gymnopedie No 1"
    );
  });
});

describe("applySuggestion", () => {
  const current: UploadMetadata = {
    title: "typed title",
    composer: "typed composer",
    arranger: "typed arranger",
    tags: "recital",
  };
  const suggestion: MetadataSuggestion = {
    id: "x",
    label: "French Suite no. 3 in B minor",
    detail: "J. S. Bach",
    sourceLabel: "Mutopia",
    title: "French Suite no. 3 in B minor",
    composer: "J. S. Bach",
    arranger: "",
    tags: ["harpsichord", "baroque"],
  };

  it("overwrites what the suggestion knows and keeps the rest", () => {
    expect(applySuggestion(current, suggestion)).toEqual({
      title: "French Suite no. 3 in B minor",
      composer: "J. S. Bach",
      arranger: "typed arranger",
      tags: "harpsichord, baroque",
    });
  });

  it("is a no-op without a suggestion", () => {
    expect(applySuggestion(current, null)).toBe(current);
  });
});
