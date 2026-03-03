"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  NOTE_PRESETS,
  KEY_SIGNATURE_OPTIONS,
  accidentalOptionsForKey,
} from "@/lib/music";
import {
  MUSICAL_SYMBOLS,
  symbolsByCategory,
  type MusicalSymbol,
} from "@/lib/symbols";

const CLEF_OPTIONS = ["treble", "bass", "both"] as const;
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
const PLAN_TYPE_OPTIONS = [
  { value: "note_identification", label: "Note Identification" },
  { value: "symbol_concepts", label: "Musical Symbols & Concepts" },
] as const;

const ALL_NOTES = [
  "C3", "D3", "E3", "F3", "G3", "A3", "B3",
  "C4", "D4", "E4", "F4", "G4", "A4", "B4",
  "C5", "D5", "E5", "F5", "G5",
];

interface PlanEditorProps {
  mode: "create" | "edit";
  planId?: string;
  initialData?: {
    name: string;
    is_template: boolean;
    plan_type: string;
    clef: "treble" | "bass" | "both";
    key_signature: string;
    include_sharps: boolean;
    include_flats: boolean;
    measures_shown: number;
    questions_per_lesson: number;
    answer_choices: number;
    notes: string[];
    symbols: MusicalSymbol[];
    difficulty: string;
    teacher_notes: string;
    show_hints: boolean;
  };
}

export function PlanEditor({ mode, planId, initialData }: PlanEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? "");
  const [isTemplate, setIsTemplate] = useState(initialData?.is_template ?? true);
  const [planType, setPlanType] = useState(initialData?.plan_type ?? "note_identification");
  const [clef, setClef] = useState<"treble" | "bass" | "both">(initialData?.clef ?? "treble");
  const [keySignature, setKeySignature] = useState(initialData?.key_signature ?? "C major");
  const [includeSharps, setIncludeSharps] = useState(initialData?.include_sharps ?? false);
  const [includeFlats, setIncludeFlats] = useState(initialData?.include_flats ?? false);
  const [measuresShown, setMeasuresShown] = useState(initialData?.measures_shown ?? 1);
  const [questionsPerLesson, setQuestionsPerLesson] = useState(initialData?.questions_per_lesson ?? 10);
  const [answerChoices, setAnswerChoices] = useState(initialData?.answer_choices ?? 4);
  const [selectedNotes, setSelectedNotes] = useState<string[]>(initialData?.notes ?? ["C4", "D4", "E4", "F4", "G4"]);
  const [presetKey, setPresetKey] = useState("Middle C Position");
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? "beginner");
  const [teacherNotes, setTeacherNotes] = useState(initialData?.teacher_notes ?? "");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(
    initialData?.symbols?.map((s) => s.id) ?? []
  );
  const [showHints, setShowHints] = useState(initialData?.show_hints ?? true);

  const accidentalOpts = accidentalOptionsForKey(keySignature);

  useEffect(() => {
    if (!accidentalOpts.sharpsEnabled) setIncludeSharps(false);
    if (!accidentalOpts.flatsEnabled) setIncludeFlats(false);
  }, [keySignature, accidentalOpts.sharpsEnabled, accidentalOpts.flatsEnabled]);

  function handlePresetChange(preset: string) {
    setPresetKey(preset);
    if (NOTE_PRESETS[preset]) {
      setSelectedNotes(NOTE_PRESETS[preset]);
    }
  }

  function toggleNote(note: string) {
    setSelectedNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    );
  }

  function toggleSymbol(symbolId: string) {
    setSelectedSymbols((prev) =>
      prev.includes(symbolId) ? prev.filter((s) => s !== symbolId) : [...prev, symbolId]
    );
  }

  function toggleCategory(category: string) {
    const categorySymbols = MUSICAL_SYMBOLS.filter((s) => s.category === category).map((s) => s.id);
    const allSelected = categorySymbols.every((id) => selectedSymbols.includes(id));
    if (allSelected) {
      setSelectedSymbols((prev) => prev.filter((id) => !categorySymbols.includes(id)));
    } else {
      setSelectedSymbols((prev) => [...new Set([...prev, ...categorySymbols])]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (planType === "note_identification" && selectedNotes.length === 0) return;
    if (planType === "symbol_concepts" && selectedSymbols.length === 0) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const symbolData = selectedSymbols
      .map((id) => MUSICAL_SYMBOLS.find((s) => s.id === id))
      .filter(Boolean);

    const payload = {
      teacher_id: user.id,
      name: name.trim(),
      is_template: isTemplate,
      plan_type: planType,
      clef,
      key_signature: keySignature,
      include_sharps: includeSharps,
      include_flats: includeFlats,
      include_chords: false,
      measures_shown: measuresShown,
      questions_per_lesson: questionsPerLesson,
      answer_choices: answerChoices,
      notes: planType === "note_identification" ? selectedNotes : [],
      symbols: planType === "symbol_concepts" ? symbolData : [],
      show_hints: showHints,
      difficulty,
      teacher_notes: teacherNotes.trim(),
    };

    let result;
    if (mode === "edit" && planId) {
      const { teacher_id, ...updatePayload } = payload;
      result = await supabase
        .from("plans")
        .update(updatePayload)
        .eq("id", planId)
        .eq("teacher_id", user.id)
        .select()
        .single();
    } else {
      result = await supabase.from("plans").insert(payload).select().single();
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    router.push("/plans");
    router.refresh();
  }

  const isNoteMode = planType === "note_identification";
  const grouped = symbolsByCategory();

  return (
    <form onSubmit={handleSubmit}>
      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Basic Info</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g., "Week 3 — Treble Clef Basics"'
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Plan Type</label>
            <div className="flex gap-2">
              {PLAN_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlanType(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    planType === opt.value
                      ? "bg-primary text-white"
                      : "bg-surface-dim text-foreground hover:bg-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-muted mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="rounded"
                />
                Template (reusable)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Teacher Notes</label>
            <textarea
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="Private notes about this lesson plan (only you can see these)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-y"
            />
          </div>
        </div>
      </Card>

      {isNoteMode ? (
        <>
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">Music Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Clef</label>
                <div className="flex gap-2">
                  {CLEF_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setClef(c)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        clef === c
                          ? "bg-primary text-white"
                          : "bg-surface-dim text-foreground hover:bg-border"
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">Key Signature</label>
                <select
                  value={keySignature}
                  onChange={(e) => setKeySignature(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {KEY_SIGNATURE_OPTIONS.map((ks) => (
                    <option key={ks} value={ks}>{ks}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <label
                  className={`flex items-center gap-2 text-sm ${
                    accidentalOpts.sharpsEnabled
                      ? "cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeSharps}
                    onChange={(e) => setIncludeSharps(e.target.checked)}
                    disabled={!accidentalOpts.sharpsEnabled}
                    className="rounded"
                  />
                  Include Sharps
                  {!accidentalOpts.sharpsEnabled && (
                    <span className="text-xs text-muted">(not used in {keySignature})</span>
                  )}
                </label>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    accidentalOpts.flatsEnabled
                      ? "cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeFlats}
                    onChange={(e) => setIncludeFlats(e.target.checked)}
                    disabled={!accidentalOpts.flatsEnabled}
                    className="rounded"
                  />
                  Include Flats
                  {!accidentalOpts.flatsEnabled && (
                    <span className="text-xs text-muted">(not used in {keySignature})</span>
                  )}
                </label>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <h2 className="font-semibold mb-3">Notes</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Preset</label>
                <select
                  value={presetKey}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {Object.keys(NOTE_PRESETS).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">
                  Selected Notes ({selectedNotes.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_NOTES.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => toggleNote(note)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                        selectedNotes.includes(note)
                          ? "bg-primary text-white"
                          : "bg-surface-dim text-muted hover:bg-border"
                      }`}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card className="mb-4">
          <h2 className="font-semibold mb-3">
            Symbols &amp; Concepts ({selectedSymbols.length} selected)
          </h2>
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, symbols]) => {
              const allSelected = symbols.every((s) => selectedSymbols.includes(s.id));
              const someSelected = symbols.some((s) => selectedSymbols.includes(s.id));
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        allSelected
                          ? "bg-primary text-white"
                          : someSelected
                            ? "bg-primary/30 text-primary"
                            : "bg-surface-dim text-muted hover:bg-border"
                      }`}
                    >
                      {allSelected ? "✓" : ""} {category}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {symbols.map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymbol(sym.id)}
                        title={`${sym.symbol} — ${sym.definition}`}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedSymbols.includes(sym.id)
                            ? "bg-primary text-white"
                            : "bg-surface-dim text-muted hover:bg-border"
                        }`}
                      >
                        <span className="mr-1">{sym.symbol}</span> {sym.term}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Lesson Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Questions per Lesson</label>
            <input
              type="number"
              min={5}
              max={30}
              value={questionsPerLesson}
              onChange={(e) => setQuestionsPerLesson(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Answer Choices</label>
            <select
              value={answerChoices}
              onChange={(e) => setAnswerChoices(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={6}>6</option>
            </select>
          </div>
          {isNoteMode && (
            <div>
              <label className="block text-sm text-muted mb-1">Measures Shown</label>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMeasuresShown(n)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      measuresShown === n
                        ? "bg-primary text-white"
                        : "bg-surface-dim text-foreground hover:bg-border"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isNoteMode && (
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={(e) => setShowHints(e.target.checked)}
                  className="rounded"
                />
                Show hints (definitions under symbols)
              </label>
              <p className="text-xs text-muted mt-1">
                When disabled, students only see the symbol and must identify it without the definition hint.
              </p>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <p className="text-error text-sm mb-4 text-center">{error}</p>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            loading ||
            (isNoteMode && selectedNotes.length === 0) ||
            (!isNoteMode && selectedSymbols.length === 0)
          }
        >
          {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Lesson Plan"}
        </Button>
      </div>
    </form>
  );
}
