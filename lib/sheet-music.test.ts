import { describe, expect, it } from "vitest";
import {
  formatFromFilename,
  parseTags,
  sanitizeFilename,
  validateMusicUpload,
} from "./sheet-music";

describe("sheet-music helpers", () => {
  it("maps extensions to formats", () => {
    expect(formatFromFilename("Moonlight.pdf")).toBe("pdf");
    expect(formatFromFilename("score.musicxml")).toBe("musicxml");
    expect(formatFromFilename("score.XML")).toBe("musicxml");
    expect(formatFromFilename("score.mxl")).toBe("mxl");
    expect(formatFromFilename("score.txt")).toBeNull();
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../evil.pdf")).toBe("evil.pdf");
    expect(sanitizeFilename("My Score (1).musicxml")).toBe("My Score (1).musicxml");
  });

  it("parses tags", () => {
    expect(parseTags("Sonatina, Grade 3; recital")).toEqual([
      "sonatina",
      "grade 3",
      "recital",
    ]);
  });

  it("validates uploads", () => {
    expect(
      validateMusicUpload({
        name: "a.pdf",
        type: "application/pdf",
        size: 100,
      })
    ).toEqual({ ok: true, format: "pdf" });
    expect(
      validateMusicUpload({
        name: "a.exe",
        type: "application/octet-stream",
        size: 100,
      }).ok
    ).toBe(false);
    expect(
      validateMusicUpload({
        name: "a.pdf",
        type: "application/pdf",
        size: 0,
      }).ok
    ).toBe(false);
  });
});
