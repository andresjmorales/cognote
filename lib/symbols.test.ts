import { describe, expect, it } from "vitest";
import { MUSICAL_SYMBOLS, localizeSymbols, symbolTerm } from "@/lib/symbols";

describe("symbolTerm", () => {
  // Driven off the catalogue so a new note value with no British name fails.
  it("names every note and rest in both systems, and nothing else in two", () => {
    for (const sym of MUSICAL_SYMBOLS) {
      if (sym.category === "Notes & Rests") {
        expect(sym.termUk, sym.id).toBeDefined();
        expect(sym.termUk, sym.id).not.toBe(sym.term);
        expect(symbolTerm(sym, "uk"), sym.id).toBe(sym.termUk);
      } else {
        expect(symbolTerm(sym, "uk"), sym.id).toBe(sym.term);
      }
      expect(symbolTerm(sym, "us"), sym.id).toBe(sym.term);
    }
  });

  it("resolves a stored plan snapshot by id, not by its own term", () => {
    // Plans keep a copy of the symbol taken when the plan was written, always
    // spelled American. The id is what survives a switch to British naming.
    const snapshot = {
      id: "quarter-note",
      term: "Quarter Note",
      symbol: "♩",
      definition: "1 beat",
    };
    expect(symbolTerm(snapshot, "uk")).toBe("Crotchet");
  });
});

describe("localizeSymbols", () => {
  it("does not mutate the input", () => {
    const input = [{ id: "whole-note", term: "Whole Note" }];
    expect(localizeSymbols(input, "uk")[0].term).toBe("Semibreve");
    expect(input[0].term).toBe("Whole Note");
  });
});
