"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NOTE_PRESETS, KEY_SIGNATURE_OPTIONS } from "@/lib/music";

const CLEF_OPTIONS = ["treble", "bass", "both"] as const;

export default function NewPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isTemplate, setIsTemplate] = useState(true);
  const [clef, setClef] = useState<"treble" | "bass" | "both">("treble");
  const [keySignature, setKeySignature] = useState("C major");
  const [includeSharps, setIncludeSharps] = useState(false);
  const [includeFlats, setIncludeFlats] = useState(false);
  const [measuresShown, setMeasuresShown] = useState(1);
  const [questionsPerLesson, setQuestionsPerLesson] = useState(10);
  const [answerChoices, setAnswerChoices] = useState(4);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
  ]);
  const [presetKey, setPresetKey] = useState("Middle C Position");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedNotes.length === 0) return;

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

    const { error: insertError } = await supabase.from("plans").insert({
      teacher_id: user.id,
      name: name.trim(),
      is_template: isTemplate,
      clef,
      key_signature: keySignature,
      include_sharps: includeSharps,
      include_flats: includeFlats,
      include_chords: false,
      measures_shown: measuresShown,
      questions_per_lesson: questionsPerLesson,
      answer_choices: answerChoices,
      notes: selectedNotes,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/plans");
    router.refresh();
  }

  const allAvailableNotes = [
    "C3", "D3", "E3", "F3", "G3", "A3", "B3",
    "C4", "D4", "E4", "F4", "G4", "A4", "B4",
    "C5", "D5", "E5", "F5", "G5",
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Plan</h1>

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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="rounded"
                />
                <span>Template (reusable for multiple students)</span>
              </label>
            </div>
          </div>
        </Card>

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
              <label className="block text-sm text-muted mb-1">
                Key Signature
              </label>
              <select
                value={keySignature}
                onChange={(e) => setKeySignature(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {KEY_SIGNATURE_OPTIONS.map((ks) => (
                  <option key={ks} value={ks}>
                    {ks}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSharps}
                  onChange={(e) => setIncludeSharps(e.target.checked)}
                  className="rounded"
                />
                Include Sharps
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFlats}
                  onChange={(e) => setIncludeFlats(e.target.checked)}
                  className="rounded"
                />
                Include Flats
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
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">
                Selected Notes ({selectedNotes.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allAvailableNotes.map((note) => (
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

        <Card className="mb-6">
          <h2 className="font-semibold mb-3">Lesson Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Questions per Lesson
              </label>
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
              <label className="block text-sm text-muted mb-1">
                Answer Choices
              </label>
              <input
                type="number"
                min={2}
                max={7}
                value={answerChoices}
                onChange={(e) => setAnswerChoices(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                Measures Shown
              </label>
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
          </div>
        </Card>

        {error && (
          <p className="text-error text-sm mb-4 text-center">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || selectedNotes.length === 0}>
            {loading ? "Creating..." : "Create Plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
