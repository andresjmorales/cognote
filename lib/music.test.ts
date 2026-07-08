import { describe, it, expect } from "vitest";
import {
  parseNote,
  noteName,
  displayNoteName,
  toVexFlowKey,
  toVexFlowNote,
  buildAnswerChoices,
  buildKeySigAnswerChoices,
  expandNotesWithAccidentals,
  shuffleAvoidingFirst,
  accidentalOptionsForKey,
  displayKeySignatureName,
} from "@/lib/music";

describe("note parsing and display", () => {
  it("parses naturals and accidentals", () => {
    expect(parseNote("C4")).toEqual({ name: "C", octave: 4 });
    expect(parseNote("F#5")).toEqual({ name: "F#", octave: 5 });
    expect(parseNote("bb2")).toEqual({ name: "Bb", octave: 2 });
  });

  it("rejects malformed notes", () => {
    expect(() => parseNote("H4")).toThrow(/Invalid note/);
    expect(() => parseNote("C")).toThrow(/Invalid note/);
    expect(() => parseNote("C##4")).toThrow(/Invalid note/);
  });

  it("renders proper musical symbols", () => {
    expect(displayNoteName("F#")).toBe("F♯");
    expect(displayNoteName("Db")).toBe("D♭");
    expect(displayNoteName("C")).toBe("C");
  });

  it("converts to VexFlow formats", () => {
    expect(noteName("F#4")).toBe("F#");
    expect(toVexFlowKey("F#5")).toBe("f#/5");
    expect(toVexFlowNote("Bb3")).toEqual({ keys: ["b/3"], accidental: "b" });
    expect(toVexFlowNote("C4")).toEqual({ keys: ["c/4"], accidental: undefined });
  });
});

describe("buildAnswerChoices", () => {
  const pool = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

  it("always includes the correct answer and the requested count, no duplicates", () => {
    for (let i = 0; i < 50; i++) {
      const choices = buildAnswerChoices("E4", pool, 4);
      expect(choices).toHaveLength(4);
      expect(choices).toContain("E");
      expect(new Set(choices).size).toBe(4);
    }
  });

  it("matches the correct answer's accidental shape (no ♯/♭ shortcut)", () => {
    // Natural correct → natural distractors
    for (let i = 0; i < 25; i++) {
      const choices = buildAnswerChoices("E4", pool, 4);
      for (const c of choices) expect(c).toMatch(/^[A-G]$/);
    }
    // Sharp correct → sharp distractors, even when the pool has no other sharps
    for (let i = 0; i < 25; i++) {
      const choices = buildAnswerChoices("F#4", pool, 4);
      expect(choices).toContain("F#");
      for (const c of choices) expect(c).toMatch(/^[A-G]#$/);
    }
  });

  it("collapses duplicate note names across octaves", () => {
    const twoOctaves = ["C4", "C5", "D4", "D5"];
    for (let i = 0; i < 25; i++) {
      const choices = buildAnswerChoices("C4", twoOctaves, 3);
      expect(new Set(choices).size).toBe(3);
    }
  });
});

describe("buildKeySigAnswerChoices", () => {
  const pool = ["C major", "G major", "D major", "F major", "Bb major"];

  it("includes the correct key and draws distractors from the pool", () => {
    for (let i = 0; i < 50; i++) {
      const choices = buildKeySigAnswerChoices("G major", pool, 4);
      expect(choices).toHaveLength(4);
      expect(choices).toContain("G major");
      for (const c of choices) expect(pool).toContain(c);
      expect(new Set(choices).size).toBe(4);
    }
  });
});

describe("expandNotesWithAccidentals", () => {
  it("returns the input unchanged when both flags are off", () => {
    expect(expandNotesWithAccidentals(["C4", "D4"], false, false)).toEqual(["C4", "D4"]);
  });

  it("adds sharps only where pedagogically used (no E#/B#)", () => {
    expect(expandNotesWithAccidentals(["C4", "E4", "B4"], true, false)).toEqual([
      "C4",
      "C#4",
      "E4",
      "B4",
    ]);
  });

  it("adds flats only where pedagogically used (no Cb/Fb)", () => {
    expect(expandNotesWithAccidentals(["C4", "D4", "F4"], false, true)).toEqual([
      "C4",
      "D4",
      "Db4",
      "F4",
    ]);
  });

  it("does not re-expand notes that already have accidentals", () => {
    expect(expandNotesWithAccidentals(["F#4"], true, true)).toEqual(["F#4"]);
  });
});

describe("accidentalOptionsForKey", () => {
  it("enables only the relevant accidental family per key", () => {
    expect(accidentalOptionsForKey("C major")).toEqual({
      sharpsEnabled: true,
      flatsEnabled: true,
    });
    expect(accidentalOptionsForKey("D major")).toEqual({
      sharpsEnabled: true,
      flatsEnabled: false,
    });
    expect(accidentalOptionsForKey("Eb major")).toEqual({
      sharpsEnabled: false,
      flatsEnabled: true,
    });
  });
});

describe("displayKeySignatureName", () => {
  it("formats accidentals but leaves the mode word alone", () => {
    expect(displayKeySignatureName("F# minor")).toBe("F♯ minor");
    expect(displayKeySignatureName("Bb major")).toBe("B♭ major");
    expect(displayKeySignatureName("C major")).toBe("C major");
  });
});

describe("shuffleAvoidingFirst", () => {
  it("never places the avoided element first (when avoidable)", () => {
    const arr = ["a", "b", "c", "d"];
    for (let i = 0; i < 200; i++) {
      expect(shuffleAvoidingFirst(arr, "a")[0]).not.toBe("a");
    }
  });

  it("keeps all elements", () => {
    const arr = [1, 2, 3, 4, 5];
    expect([...shuffleAvoidingFirst(arr, 3)].sort()).toEqual(arr);
  });

  it("tolerates single-element arrays", () => {
    expect(shuffleAvoidingFirst(["only"], "only")).toEqual(["only"]);
  });
});
