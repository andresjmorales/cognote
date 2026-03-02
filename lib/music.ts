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
  const match = note.match(/^([A-Ga-g][#b]?)(\d)$/);
  if (!match) throw new Error(`Invalid note: ${note}`);
  return { name: match[1].toUpperCase(), octave: parseInt(match[2], 10) };
}

/** Get just the letter name (no accidental, no octave). "F#4" → "F#" */
export function noteName(note: string): string {
  return parseNote(note).name;
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
 * If the note pool doesn't have enough distinct note names, pad from ALL_NOTE_LABELS.
 */
export function buildAnswerChoices(
  correctNote: string,
  notePool: string[],
  totalChoices: number
): string[] {
  const correct = noteName(correctNote);
  const distractorCount = totalChoices - 1;

  let distractors = generateDistractors(correctNote, notePool, distractorCount);

  if (distractors.length < distractorCount) {
    const existing = new Set([correct, ...distractors]);
    const extras = ALL_NOTE_LABELS.filter((n) => !existing.has(n));
    distractors = [
      ...distractors,
      ...shuffle([...extras]).slice(0, distractorCount - distractors.length),
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
 * Map key signature names to VexFlow key signature strings.
 */
export const KEY_SIGNATURES: Record<string, string> = {
  "C major": "C",
  "G major": "G",
  "D major": "D",
  "A major": "A",
  "E major": "E",
  "B major": "B",
  "F major": "F",
  "Bb major": "Bb",
  "Eb major": "Eb",
  "Ab major": "Ab",
  "A minor": "Am",
  "E minor": "Em",
  "D minor": "Dm",
  "G minor": "Gm",
  "C minor": "Cm",
};

/** All available key signature display names */
export const KEY_SIGNATURE_OPTIONS = Object.keys(KEY_SIGNATURES);

/** Which key signatures inherently use sharps */
export const KEYS_WITH_SHARPS = new Set([
  "G major", "D major", "A major", "E major", "B major",
  "E minor", "B minor",
]);

/** Which key signatures inherently use flats */
export const KEYS_WITH_FLATS = new Set([
  "F major", "Bb major", "Eb major", "Ab major",
  "D minor", "G minor", "C minor",
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
