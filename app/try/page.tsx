"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { QuizEngine, type QuizConfig } from "@/components/music/QuizEngine";
import {
  FlashcardEngine,
  type FlashcardItem,
} from "@/components/music/FlashcardEngine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";
import { NOTE_PRESETS, shuffle } from "@/lib/music";
import { defaultFlashcardState } from "@/lib/srs";

type Screen = "pick" | "welcome" | "lesson" | "free_practice" | "flashcard";

interface PresetChoice {
  label: string;
  preset: string;
  clef: "treble" | "bass";
  description: string;
}

const PRESET_OPTIONS: PresetChoice[] = [
  { label: "Middle C Position", preset: "Middle C Position", clef: "treble", description: "C D E F G — great for beginners" },
  { label: "Treble Staff Lines", preset: "Treble Staff (lines)", clef: "treble", description: "E G B D F — Every Good Boy Does Fine" },
  { label: "Treble Staff Spaces", preset: "Treble Staff (spaces)", clef: "treble", description: "F A C E — the spaces spell FACE" },
  { label: "Bass Staff Lines", preset: "Bass Staff (lines)", clef: "bass", description: "G B D F A — Good Boys Do Fine Always" },
  { label: "Bass Staff Spaces", preset: "Bass Staff (spaces)", clef: "bass", description: "A C E G — All Cows Eat Grass" },
];

export default function TryLessonPage() {
  const [screen, setScreen] = useState<Screen>("pick");
  const [chosen, setChosen] = useState<PresetChoice | null>(null);

  function pickPreset(opt: PresetChoice) {
    setChosen(opt);
    setScreen("welcome");
  }

  function buildQuizConfig(mode: "lesson" | "free_practice"): QuizConfig {
    return {
      notes: NOTE_PRESETS[chosen!.preset],
      clef: chosen!.clef,
      keySignature: "C major",
      questionsPerLesson: 10,
      answerChoices: 4,
      mode,
    };
  }

  function buildFlashcardItems(): FlashcardItem[] {
    const notes = NOTE_PRESETS[chosen!.preset];
    return shuffle(
      notes.map((note) => ({
        itemType: "note" as const,
        note,
        clef: chosen!.clef,
        state: defaultFlashcardState(),
      }))
    );
  }

  // --- Quiz / Free Practice ---
  if ((screen === "lesson" || screen === "free_practice") && chosen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-2 font-[family-name:var(--font-nunito)]">
        <QuizEngine
          config={buildQuizConfig(screen)}
          onQuit={() => setScreen("welcome")}
        />
      </div>
    );
  }

  // --- Flashcards ---
  if (screen === "flashcard" && chosen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-2 font-[family-name:var(--font-nunito)]">
        <FlashcardEngine
          cards={buildFlashcardItems()}
          keySignature="C major"
          onQuit={() => setScreen("welcome")}
        />
      </div>
    );
  }

  // --- Welcome (mode picker) ---
  if (screen === "welcome" && chosen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
        <Card padding="lg" className="max-w-sm text-center w-full">
          <div className="text-5xl mb-2">🎵</div>
          <h1 className="text-3xl font-bold mb-1">Ready to practice!</h1>
          <p className="text-muted mb-6">{chosen.label}</p>

          <div className="flex flex-col gap-3">
            <Button
              size="xl"
              onClick={() => setScreen("lesson")}
              className="w-full"
            >
              Start Quiz
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setScreen("free_practice")}
              className="w-full"
            >
              Free Practice
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setScreen("flashcard")}
              className="w-full"
            >
              Flashcards
            </Button>
          </div>

          <div className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => setScreen("pick")}>
              Pick Different Notes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // --- Preset Picker ---
  return (
    <div className="min-h-screen flex flex-col bg-background font-[family-name:var(--font-nunito)]">
      <header className="border-b border-border bg-surface shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight">
            <BrandMark size={BRAND_ICON_SIZE.header} className="h-8 w-8" />
            CogNote
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎵</div>
            <h1 className="text-3xl font-bold mb-2">Try a Lesson</h1>
            <p className="text-muted">
              Pick a set of notes and test your music reading skills!
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PRESET_OPTIONS.map((opt) => (
              <Card key={opt.preset} className="cursor-pointer hover:border-primary transition-colors" onClick={() => pickPreset(opt)}>
                <button className="w-full text-left px-4 py-3" type="button">
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-sm text-muted">{opt.description}</div>
                </button>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm">Back to Home</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
