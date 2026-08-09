import { expandNotesWithAccidentals, shuffle } from "@/lib/music";
import { defaultFlashcardState, type FlashcardState } from "@/lib/srs";

/**
 * Flashcard deck construction shared by the student practice page and the
 * teacher lesson preview. Builds one card per item/clef combination for the
 * plan type, merging any saved spaced-repetition progress.
 */

export interface NoteCard {
  itemType: "note";
  note: string;
  clef: "treble" | "bass";
  state: FlashcardState;
}

export interface SymbolCard {
  itemType: "symbol";
  symbolId: string;
  symbol: string;
  term: string;
  definition: string;
  state: FlashcardState;
}

export interface KeySignatureCard {
  itemType: "key_signature";
  keyName: string;
  clef: "treble" | "bass";
  state: FlashcardState;
}

export type FlashcardItem = NoteCard | SymbolCard | KeySignatureCard;

export interface FlashcardPlanSource {
  plan_type: "note_identification" | "key_signature_identification" | "symbol_concepts";
  clef: "treble" | "bass" | "both";
  notes?: string[] | null;
  symbols?: { id: string; symbol: string; term: string; definition: string }[] | null;
  key_signatures?: string[] | null;
  include_sharps?: boolean | null;
  include_flats?: boolean | null;
}

/** Saved SRS progress row from flashcard_progress (note = item id). */
export interface FlashcardProgressRow {
  item_type?: string | null;
  note: string;
  clef?: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

function stateFrom(row: FlashcardProgressRow | undefined): FlashcardState {
  if (!row) return defaultFlashcardState();
  return {
    easeFactor: row.ease_factor,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
  };
}

export function buildFlashcardItems(
  plan: FlashcardPlanSource,
  progress: FlashcardProgressRow[] = []
): FlashcardItem[] {
  const clefs: ("treble" | "bass")[] =
    plan.clef === "both" ? ["treble", "bass"] : [plan.clef];

  if (plan.plan_type === "key_signature_identification") {
    const items: FlashcardItem[] = [];
    for (const keyName of plan.key_signatures ?? []) {
      for (const clef of clefs) {
        const existing = progress.find(
          (p) => p.item_type === "key_signature" && p.note === keyName && p.clef === clef
        );
        items.push({
          itemType: "key_signature",
          keyName,
          clef,
          state: stateFrom(existing),
        });
      }
    }
    return shuffle(items);
  }

  if (plan.plan_type === "symbol_concepts") {
    return shuffle(
      (plan.symbols ?? []).map((sym): FlashcardItem => {
        const existing = progress.find(
          (p) => p.item_type === "symbol" && p.note === sym.id
        );
        return {
          itemType: "symbol",
          symbolId: sym.id,
          symbol: sym.symbol,
          term: sym.term,
          definition: sym.definition,
          state: stateFrom(existing),
        };
      })
    );
  }

  const expandedNotes = expandNotesWithAccidentals(
    plan.notes ?? [],
    plan.include_sharps ?? false,
    plan.include_flats ?? false
  );
  const items: FlashcardItem[] = [];
  for (const note of expandedNotes) {
    for (const clef of clefs) {
      // Rows written before item_type existed are note cards.
      const existing = progress.find(
        (p) =>
          p.note === note &&
          p.clef === clef &&
          (p.item_type === "note" || !p.item_type)
      );
      items.push({ itemType: "note", note, clef, state: stateFrom(existing) });
    }
  }
  return shuffle(items);
}
