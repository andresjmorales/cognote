import { describe, expect, it } from "vitest";
import {
  cleanImslpFieldValue,
  extractImslpField,
  findIndexedResult,
  searchStaticIndexes,
  sourceLinkLabel,
} from "./music-sources";

describe("music-sources search", () => {
  it("finds Mutopia Bach results that are importable PDFs", () => {
    const results = searchStaticIndexes("bach", { sources: ["mutopia"] });
    expect(results.length).toBeGreaterThan(0);
    const importable = results.filter((r) => r.import_allowed);
    expect(importable.length).toBeGreaterThan(0);
    expect(importable.every((r) => r.file_url?.endsWith(".pdf"))).toBe(true);
    expect(importable[0].format).toBe("pdf");
  });

  it("excludes CC BY-SA from import_allowed", () => {
    const sa = searchStaticIndexes("danube", { sources: ["mutopia"] }).filter(
      (r) => r.license_code === "cc_by_sa"
    );
    for (const r of sa) {
      expect(r.import_allowed).toBe(false);
    }
  });

  it("imports OpenScore Lieder MXL from GitHub when present", () => {
    const results = searchStaticIndexes("beggar maid", {
      sources: ["openscore-lieder"],
    });
    expect(results.length).toBeGreaterThan(0);
    const hit = results.find((r) => /beggar/i.test(r.title));
    expect(hit).toBeTruthy();
    expect(hit!.license_code).toBe("cc0");
    expect(hit!.import_allowed).toBe(true);
    expect(hit!.format).toBe("mxl");
    expect(hit!.file_url).toMatch(
      /raw\.githubusercontent\.com\/OpenScore\/Lieder\/.+\.mxl$/
    );
    expect(sourceLinkLabel(hit!.source)).toBe("Open in MuseScore");
  });

  it("filters importable-only and instrument", () => {
    const all = searchStaticIndexes("piano", { sources: ["mutopia"] });
    const importable = searchStaticIndexes("piano", {
      sources: ["mutopia"],
      importableOnly: true,
    });
    expect(importable.every((r) => r.import_allowed)).toBe(true);
    expect(importable.length).toBeLessThanOrEqual(all.length);

    const voice = searchStaticIndexes("song", {
      sources: ["mutopia", "openscore-lieder"],
      instrument: "voice",
    });
    expect(
      voice.every((r) => (r.instrument ?? "").toLowerCase().includes("voice"))
    ).toBe(true);
  });

  it("looks up indexed Mutopia ids", () => {
    const sample = searchStaticIndexes("beethoven", { sources: ["mutopia"] }).find(
      (r) => r.import_allowed && r.file_url?.endsWith(".pdf")
    );
    expect(sample).toBeTruthy();
    const found = findIndexedResult(sample!.id);
    expect(found?.title).toBe(sample!.title);
  });

  it("labels IMSLP links as View source", () => {
    expect(sourceLinkLabel("imslp")).toBe("View source");
    expect(sourceLinkLabel("mutopia")).toBe("View source");
  });
});

describe("IMSLP field cleanup", () => {
  const sample = `
| *****WORK INFO*****
|Work Title=Make Me a Clean Heart, O God
|Key={{Key|c}}
|Piece Style=Romantic
|Instrumentation=SATB with keyboard accompaniment
| *****COMMENTS*****
`;

  const rebekah = `
|Instrumentation=soprano (Rebekah), tenor (Isaac), bass (Eliezer); mixed chorus (SATBB)<br>orchestra
|Piece Style=Romantic
`;

  it("keeps full {{Key|c}} values instead of truncating at the pipe", () => {
    expect(extractImslpField(sample, "Key")).toBe("C minor");
    expect(extractImslpField(sample, "Instrumentation")).toBe(
      "SATB with keyboard accompaniment"
    );
    expect(extractImslpField(sample, "Piece Style")).toBe("Romantic");
  });

  it("turns br tags into separators and drops leftover braces", () => {
    expect(extractImslpField(rebekah, "Instrumentation")).toBe(
      "soprano (Rebekah), tenor (Isaac), bass (Eliezer); mixed chorus (SATBB); orchestra"
    );
    expect(cleanImslpFieldValue("Key {{Key")).toBe("Key");
    expect(cleanImslpFieldValue("{{Key|D}}")).toBe("D major");
  });

  it("decodes a single HTML entity level", () => {
    expect(cleanImslpFieldValue("flute &amp; piano")).toBe("flute & piano");
    expect(cleanImslpFieldValue("a &lt; b")).toBe("a < b");
  });
});
