/**
 * Musical symbols and concepts for the symbol/concept quiz mode.
 */

export interface MusicalSymbol {
  id: string;
  category: string;
  symbol: string;
  term: string;
  definition: string;
}

export const SYMBOL_CATEGORIES = [
  "Dynamics",
  "Tempo",
  "Articulation",
  "Notes & Rests",
  "Accidentals",
  "Notation",
  "Repeats & Navigation",
] as const;

export type SymbolCategory = (typeof SYMBOL_CATEGORIES)[number];

export const MUSICAL_SYMBOLS: MusicalSymbol[] = [
  // Dynamics
  { id: "pp", category: "Dynamics", symbol: "pp", term: "Pianissimo", definition: "Very soft" },
  { id: "p", category: "Dynamics", symbol: "p", term: "Piano", definition: "Soft" },
  { id: "mp", category: "Dynamics", symbol: "mp", term: "Mezzo-piano", definition: "Moderately soft" },
  { id: "mf", category: "Dynamics", symbol: "mf", term: "Mezzo-forte", definition: "Moderately loud" },
  { id: "f", category: "Dynamics", symbol: "f", term: "Forte", definition: "Loud" },
  { id: "ff", category: "Dynamics", symbol: "ff", term: "Fortissimo", definition: "Very loud" },
  { id: "crescendo", category: "Dynamics", symbol: "cresc. (\u003C)", term: "Crescendo", definition: "Gradually get louder" },
  { id: "decrescendo", category: "Dynamics", symbol: "decresc. (\u003E)", term: "Decrescendo", definition: "Gradually get softer" },

  // Tempo
  { id: "rit", category: "Tempo", symbol: "rit.", term: "Ritardando", definition: "Gradually slow down" },
  { id: "accel", category: "Tempo", symbol: "accel.", term: "Accelerando", definition: "Gradually speed up" },
  { id: "allegro", category: "Tempo", symbol: "Allegro", term: "Allegro", definition: "Fast and lively" },
  { id: "andante", category: "Tempo", symbol: "Andante", term: "Andante", definition: "At a walking pace" },
  { id: "adagio", category: "Tempo", symbol: "Adagio", term: "Adagio", definition: "Slow and stately" },
  { id: "moderato", category: "Tempo", symbol: "Moderato", term: "Moderato", definition: "At a moderate speed" },
  { id: "presto", category: "Tempo", symbol: "Presto", term: "Presto", definition: "Very fast" },
  { id: "a-tempo", category: "Tempo", symbol: "a tempo", term: "A Tempo", definition: "Return to the original speed" },
  { id: "fermata", category: "Tempo", symbol: "𝄐", term: "Fermata", definition: "Hold the note longer than its value" },

  // Articulation
  { id: "staccato", category: "Articulation", symbol: "• (dot above note)", term: "Staccato", definition: "Short and detached" },
  { id: "legato", category: "Articulation", symbol: "⌢ (curved line)", term: "Legato / Slur", definition: "Smooth and connected" },
  { id: "accent", category: "Articulation", symbol: "> (above note)", term: "Accent", definition: "Play the note with emphasis" },
  { id: "tenuto", category: "Articulation", symbol: "— (line above note)", term: "Tenuto", definition: "Hold the note for its full value" },

  // Notes & Rests
  { id: "whole-note", category: "Notes & Rests", symbol: "𝅝", term: "Whole Note", definition: "4 beats" },
  { id: "half-note", category: "Notes & Rests", symbol: "𝅗𝅥", term: "Half Note", definition: "2 beats" },
  { id: "quarter-note", category: "Notes & Rests", symbol: "♩", term: "Quarter Note", definition: "1 beat" },
  { id: "eighth-note", category: "Notes & Rests", symbol: "♪", term: "Eighth Note", definition: "½ beat" },
  { id: "dotted-half", category: "Notes & Rests", symbol: "𝅗𝅥.", term: "Dotted Half Note", definition: "3 beats" },
  { id: "whole-rest", category: "Notes & Rests", symbol: "▬ (hangs from line)", term: "Whole Rest", definition: "4 beats of silence" },
  { id: "half-rest", category: "Notes & Rests", symbol: "▬ (sits on line)", term: "Half Rest", definition: "2 beats of silence" },
  { id: "quarter-rest", category: "Notes & Rests", symbol: "𝄾", term: "Quarter Rest", definition: "1 beat of silence" },

  // Accidentals
  { id: "sharp", category: "Accidentals", symbol: "♯", term: "Sharp", definition: "Raise the pitch by a half step" },
  { id: "flat", category: "Accidentals", symbol: "♭", term: "Flat", definition: "Lower the pitch by a half step" },
  { id: "natural", category: "Accidentals", symbol: "♮", term: "Natural", definition: "Cancel a sharp or flat" },

  // Notation
  { id: "treble-clef", category: "Notation", symbol: "𝄞", term: "Treble Clef", definition: "Indicates higher-pitched notes (right hand)" },
  { id: "bass-clef", category: "Notation", symbol: "𝄢", term: "Bass Clef", definition: "Indicates lower-pitched notes (left hand)" },
  { id: "time-sig-44", category: "Notation", symbol: "4/4", term: "Common Time", definition: "4 beats per measure" },
  { id: "time-sig-34", category: "Notation", symbol: "3/4", term: "Waltz Time", definition: "3 beats per measure" },
  { id: "time-sig-24", category: "Notation", symbol: "2/4", term: "March Time", definition: "2 beats per measure" },
  { id: "tie", category: "Notation", symbol: "⌢ (between same notes)", term: "Tie", definition: "Connect two notes of the same pitch into one longer note" },

  // Repeats & Navigation
  { id: "repeat-sign", category: "Repeats & Navigation", symbol: "𝄆 𝄇", term: "Repeat Signs", definition: "Play the section again" },
  { id: "dc-al-fine", category: "Repeats & Navigation", symbol: "D.C. al Fine", term: "Da Capo al Fine", definition: "Go back to the beginning and play until 'Fine'" },
  { id: "ds-al-coda", category: "Repeats & Navigation", symbol: "D.S. al Coda", term: "Dal Segno al Coda", definition: "Go back to the sign (𝄋) and play until the coda (⊕)" },
  { id: "fine", category: "Repeats & Navigation", symbol: "Fine", term: "Fine", definition: "The end" },
  { id: "coda", category: "Repeats & Navigation", symbol: "⊕", term: "Coda", definition: "Jump to the ending section" },
];

/** Group symbols by category */
export function symbolsByCategory(): Record<string, MusicalSymbol[]> {
  const grouped: Record<string, MusicalSymbol[]> = {};
  for (const sym of MUSICAL_SYMBOLS) {
    if (!grouped[sym.category]) grouped[sym.category] = [];
    grouped[sym.category].push(sym);
  }
  return grouped;
}

/** Get a symbol by ID */
export function getSymbolById(id: string): MusicalSymbol | undefined {
  return MUSICAL_SYMBOLS.find((s) => s.id === id);
}
