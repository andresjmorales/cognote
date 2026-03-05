/**
 * Music theory utilities for note naming, VexFlow key conversion, and quiz logic.
 */

const NOTE_NAMES = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

/** All chromatic note names including enharmonics we care about */
const ALL_NOTE_LABELS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
] as const;

/** Parse "C#4" → { name: "C#", octave: 4 } */
export function parseNote(note: string): { name: string; octave: number } {
  const match = note.match(/^([A-Ga-g])([#b]?)(\d)$/);
  if (!match) throw new Error(`Invalid note: ${note}`);
  return { name: match[1].toUpperCase() + match[2], octave: parseInt(match[3], 10) };
}

/** Get just the letter name (no accidental, no octave). "F#4" → "F#" */
export function noteName(note: string): string {
  return parseNote(note).name;
}

/** Format for display with proper musical symbols: "F#4" → "F♯4", "Db" → "D♭" */
export function displayNoteName(name: string): string {
  if (name.length <= 1) return name;
  return name[0] + name.slice(1).replace("#", "♯").replace("b", "♭");
}

/** Get just the letter (no accidental). "F#4" → "F" */
export function noteLetter(note: string): string {
  return parseNote(note).name[0];
}

/**
 * Convert our note format ("C4", "F#5") to VexFlow key format ("c/4", "f#/5").
 */
export function toVexFlowKey(note: string): string {
  const { name, octave } = parseNote(note);
  return `${name.toLowerCase()}/${octave}`;
}

/**
 * Convert our note format to VexFlow duration + accidental info.
 * Returns { keys: ["c/4"], accidental?: "#" | "b" }
 */
export function toVexFlowNote(note: string): {
  keys: string[];
  accidental?: string;
} {
  const { name, octave } = parseNote(note);
  const letter = name[0].toLowerCase();
  const accidental = name.length > 1 ? name[1] : undefined;
  return {
    keys: [`${letter}/${octave}`],
    accidental: accidental === "#" ? "#" : accidental === "b" ? "b" : undefined,
  };
}

/**
 * Generate plausible wrong answers for a quiz question.
 * Picks from the plan's note set, excluding the correct answer,
 * preferring notes that are close in pitch.
 */
export function generateDistractors(
  correctNote: string,
  notePool: string[],
  count: number
): string[] {
  const correctName = noteName(correctNote);
  const others = notePool
    .map((n) => noteName(n))
    .filter((n) => n !== correctName);

  const unique = [...new Set(others)];
  return shuffle(unique).slice(0, count);
}

/**
 * Build a full set of answer choices: 1 correct + N distractors.
 * Distractors match the correct answer's "shape" — if the correct answer has an
 * accidental, distractors also have accidentals (and vice versa), so students
 * can't use the presence/absence of ♯/♭ as a shortcut.
 */
export function buildAnswerChoices(
  correctNote: string,
  notePool: string[],
  totalChoices: number
): string[] {
  const correct = noteName(correctNote);
  const distractorCount = totalChoices - 1;
  const correctAcc = correct.length > 1 ? correct.slice(1) : "";
  const sameShape = (n: string) => {
    const acc = n.length > 1 ? n.slice(1) : "";
    return acc === correctAcc;
  };

  const poolNames = [...new Set(notePool.map((n) => noteName(n)))].filter((n) => n !== correct);
  let distractors = shuffle(poolNames.filter(sameShape)).slice(0, distractorCount);

  if (distractors.length < distractorCount) {
    const used = new Set([correct, ...distractors]);
    const extras = [...ALL_NOTE_LABELS].filter((n) => sameShape(n) && !used.has(n));
    distractors = [
      ...distractors,
      ...shuffle(extras).slice(0, distractorCount - distractors.length),
    ];
  }

  if (distractors.length < distractorCount) {
    const used = new Set([correct, ...distractors]);
    const fallback = [...ALL_NOTE_LABELS].filter((n) => !used.has(n));
    distractors = [
      ...distractors,
      ...shuffle(fallback).slice(0, distractorCount - distractors.length),
    ];
  }

  return shuffle([correct, ...distractors.slice(0, distractorCount)]);
}

/** Pick a random element */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher–Yates shuffle (returns new array) */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffle array but ensure the first element is not `avoidFirst` (if provided and possible).
 * Use when refilling a quiz bag so the same item doesn't appear first right after a reshuffle.
 */
export function shuffleAvoidingFirst<T>(arr: T[], avoidFirst?: T | null): T[] {
  const a = shuffle(arr);
  if (arr.length > 1 && avoidFirst != null && a[0] === avoidFirst) {
    const swap = Math.floor(Math.random() * (a.length - 1)) + 1;
    [a[0], a[swap]] = [a[swap], a[0]];
  }
  return a;
}

/**
 * Map key signature names to VexFlow key signature strings.
 * Includes relative minor names (e.g. "F# minor" → "A") for key-sig ID when scale is "both".
 * Full circle of fifths: 0–7 sharps and 1–7 flats (15 distinct key signature visuals).
 */
export const KEY_SIGNATURES: Record<string, string> = {
  // Major keys: 0–7 sharps, then 1–7 flats
  "C major": "C",
  "G major": "G",
  "D major": "D",
  "A major": "A",
  "E major": "E",
  "B major": "B",
  "F# major": "F#",
  "C# major": "C#",
  "F major": "F",
  "Bb major": "Bb",
  "Eb major": "Eb",
  "Ab major": "Ab",
  "Db major": "Db",
  "Gb major": "Gb",
  "Cb major": "Cb",
  // Minor keys (same 15 key-sig slots)
  "A minor": "Am",
  "E minor": "Em",
  "D minor": "Dm",
  "G minor": "Gm",
  "C minor": "Cm",
  "F# minor": "A",
  "B minor": "D",
  "C# minor": "E",
  "G# minor": "B",
  "D# minor": "F#",
  "A# minor": "C#",
  "F minor": "Ab",
  "Bb minor": "Db",
  "Eb minor": "Gb",
  "Ab minor": "Cb",
};

/** All available key signature display names (used for note-ID plan key selector) */
export const KEY_SIGNATURE_OPTIONS = [
  "C major", "G major", "D major", "A major", "E major", "B major", "F# major", "C# major",
  "F major", "Bb major", "Eb major", "Ab major", "Db major", "Gb major", "Cb major",
  "A minor", "E minor", "D minor", "G minor", "C minor",
  "F# minor", "B minor", "C# minor", "G# minor", "D# minor", "A# minor",
  "F minor", "Bb minor", "Eb minor", "Ab minor",
];

/** Key names that are major keys (15: full circle of fifths) */
export const KEY_SIG_MAJOR_OPTIONS: string[] = [
  "C major", "G major", "D major", "A major", "E major", "B major", "F# major", "C# major",
  "F major", "Bb major", "Eb major", "Ab major", "Db major", "Gb major", "Cb major",
];

/** Key names that are minor keys (15: full circle of fifths) */
export const KEY_SIG_MINOR_OPTIONS: string[] = [
  "A minor", "E minor", "D minor", "G minor", "C minor", "F# minor", "B minor", "C# minor",
  "G# minor", "D# minor", "A# minor",
  "F minor", "Bb minor", "Eb minor", "Ab minor",
];

/** All 30 key names used in key-sig ID (15 major + 15 minor; 15 shared visuals) */
export const KEY_SIG_ID_OPTIONS = [...new Set([...KEY_SIG_MAJOR_OPTIONS, ...KEY_SIG_MINOR_OPTIONS])];

/**
 * Natural groupings for key signature selection (by accidental count / type).
 * Used for pill selector in key-sig ID plan editor. Full 1–7 sharps and 1–7 flats.
 */
export const KEY_SIG_GROUPS: { label: string; keys: string[] }[] = [
  { label: "No accidentals", keys: ["C major", "A minor"] },
  { label: "1–3 sharps", keys: ["G major", "E minor", "D major", "B minor", "A major", "F# minor"] },
  { label: "4–5 sharps", keys: ["E major", "C# minor", "B major", "G# minor"] },
  { label: "6–7 sharps", keys: ["F# major", "D# minor", "C# major", "A# minor"] },
  { label: "1–3 flats", keys: ["F major", "D minor", "Bb major", "G minor", "Eb major", "C minor"] },
  { label: "4–5 flats", keys: ["Ab major", "F minor", "Db major", "Bb minor"] },
  { label: "6–7 flats", keys: ["Gb major", "Eb minor", "Cb major", "Ab minor"] },
];

/** Options for key-sig ID scale mode */
export type KeySigScaleMode = "major" | "minor" | "both";

/** Get the list of key names to offer for key-sig ID given scale mode */
export function keySigOptionsForScaleMode(mode: KeySigScaleMode): string[] {
  if (mode === "major") return KEY_SIG_MAJOR_OPTIONS;
  if (mode === "minor") return KEY_SIG_MINOR_OPTIONS;
  return KEY_SIG_ID_OPTIONS;
}

/**
 * Build answer choices for key signature ID quiz: 1 correct key name + distractors from pool.
 */
export function buildKeySigAnswerChoices(
  correctKeyName: string,
  keyPool: string[],
  totalChoices: number
): string[] {
  const others = keyPool.filter((k) => k !== correctKeyName);
  const distractors = shuffle(others).slice(0, totalChoices - 1);
  return shuffle([correctKeyName, ...distractors]);
}

/** Format key signature name for display: "F# minor" → "F♯ minor" */
export function displayKeySignatureName(keyName: string): string {
  const i = keyName.indexOf(" ");
  const keyPart = i >= 0 ? keyName.slice(0, i) : keyName;
  const rest = i >= 0 ? keyName.slice(i) : "";
  const formatted =
    keyPart[0] + (keyPart.length > 1 ? keyPart.slice(1).replace("#", "♯").replace("b", "♭") : "");
  return rest ? `${formatted}${rest}` : formatted;
}

/** Which key signatures inherently use sharps (1–7 sharps) */
export const KEYS_WITH_SHARPS = new Set([
  "G major", "D major", "A major", "E major", "B major", "F# major", "C# major",
  "E minor", "B minor", "F# minor", "C# minor", "G# minor", "D# minor", "A# minor",
]);

/** Which key signatures inherently use flats (1–7 flats) */
export const KEYS_WITH_FLATS = new Set([
  "F major", "Bb major", "Eb major", "Ab major", "Db major", "Gb major", "Cb major",
  "D minor", "G minor", "C minor", "F minor", "Bb minor", "Eb minor", "Ab minor",
]);

/** C major / A minor have neither sharps nor flats in the key signature */
export const KEYS_NEUTRAL = new Set(["C major", "A minor"]);

/**
 * Returns which accidental checkboxes should be enabled for a given key signature.
 * - Keys with sharps: "include sharps" is relevant, "include flats" is not
 * - Keys with flats: "include flats" is relevant, "include sharps" is not
 * - Neutral keys (C major, A minor): both are relevant
 */
export function accidentalOptionsForKey(key: string): {
  sharpsEnabled: boolean;
  flatsEnabled: boolean;
} {
  if (KEYS_NEUTRAL.has(key)) return { sharpsEnabled: true, flatsEnabled: true };
  if (KEYS_WITH_SHARPS.has(key)) return { sharpsEnabled: true, flatsEnabled: false };
  if (KEYS_WITH_FLATS.has(key)) return { sharpsEnabled: false, flatsEnabled: true };
  return { sharpsEnabled: true, flatsEnabled: true };
}

/**
 * Expand a set of natural notes with sharp/flat variants.
 * E#/B# and Cb/Fb are omitted as they're enharmonic equivalents rarely used in pedagogy.
 */
const SHARP_NOTES = new Set(["C", "D", "F", "G", "A"]);
const FLAT_NOTES = new Set(["D", "E", "G", "A", "B"]);

export function expandNotesWithAccidentals(
  notes: string[],
  includeSharps: boolean,
  includeFlats: boolean
): string[] {
  if (!includeSharps && !includeFlats) return notes;

  const expanded: string[] = [];
  for (const note of notes) {
    expanded.push(note);
    const { name, octave } = parseNote(note);
    const letter = name[0];
    if (name.length > 1) continue; // already has an accidental

    if (includeSharps && SHARP_NOTES.has(letter)) {
      expanded.push(`${letter}#${octave}`);
    }
    if (includeFlats && FLAT_NOTES.has(letter)) {
      expanded.push(`${letter}b${octave}`);
    }
  }
  return expanded;
}

/**
 * Common note presets teachers can choose from.
 */
export const NOTE_PRESETS: Record<string, string[]> = {
  "Middle C Position": ["C4", "D4", "E4", "F4", "G4"],
  "Treble Staff (lines)": ["E4", "G4", "B4", "D5", "F5"],
  "Treble Staff (spaces)": ["F4", "A4", "C5", "E5"],
  "Treble Staff (all)": ["E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"],
  "Bass Staff (lines)": ["G2", "B2", "D3", "F3", "A3"],
  "Bass Staff (spaces)": ["A2", "C3", "E3", "G3"],
  "Bass Staff (all)": ["G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3"],
  "Grand Staff (C position)": ["C3", "D3", "E3", "F3", "G3", "C4", "D4", "E4", "F4", "G4"],
};
