"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FlashcardEngine,
  type FlashcardItem,
} from "@/components/music/FlashcardEngine";
import {
  KeySignatureQuizEngine,
  type KeySignatureQuizConfig,
} from "@/components/music/KeySignatureQuizEngine";
import { QuizEngine, type QuizConfig } from "@/components/music/QuizEngine";
import {
  SymbolQuizEngine,
  type SymbolItem,
  type SymbolQuizConfig,
} from "@/components/music/SymbolQuizEngine";
import { expandNotesWithAccidentals, shuffle } from "@/lib/music";
import { defaultFlashcardState } from "@/lib/srs";

type Mode = "welcome" | "lesson" | "free_practice" | "flashcard";

interface PlanData {
  name: string;
  clef: "treble" | "bass" | "both";
  key_signature: string;
  include_sharps: boolean;
  include_flats: boolean;
  questions_per_lesson: number;
  answer_choices: number;
  notes: string[];
  plan_type: "note_identification" | "key_signature_identification" | "symbol_concepts";
  symbols: SymbolItem[];
  show_hints: boolean;
  key_sig_scale_mode?: "major" | "minor" | "both";
  key_signatures?: string[];
}

export type { PlanData };

export function PlanPreviewPlayer({ plan }: { plan: PlanData }) {
  const [mode, setMode] = useState<Mode>("welcome");

  function buildFlashcards() {
    if (plan.plan_type === "key_signature_identification") {
      const keySignatures = plan.key_signatures ?? [];
      const clefs: ("treble" | "bass")[] =
        plan.clef === "both" ? ["treble", "bass"] : [plan.clef];

      const items: FlashcardItem[] = [];
      for (const keyName of keySignatures) {
        for (const clef of clefs) {
          items.push({
            itemType: "key_signature",
            keyName,
            clef,
            state: defaultFlashcardState(),
          });
        }
      }

      return shuffle(items);
    }

    if (plan.plan_type === "symbol_concepts") {
      return shuffle(
        (plan.symbols ?? []).map((symbol) => ({
          itemType: "symbol" as const,
          symbolId: symbol.id,
          symbol: symbol.symbol,
          term: symbol.term,
          definition: symbol.definition,
          state: defaultFlashcardState(),
        }))
      );
    }

    const expandedNotes = expandNotesWithAccidentals(
      plan.notes,
      plan.include_sharps ?? false,
      plan.include_flats ?? false,
    );
    const clefs: ("treble" | "bass")[] =
      plan.clef === "both" ? ["treble", "bass"] : [plan.clef];

    const items: FlashcardItem[] = [];
    for (const note of expandedNotes) {
      for (const clef of clefs) {
        items.push({
          itemType: "note",
          note,
          clef,
          state: defaultFlashcardState(),
        });
      }
    }

    return shuffle(items);
  }

  if (mode === "welcome") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
        <Card padding="lg" className="max-w-sm text-center w-full">
          <div className="text-5xl mb-2">🎵</div>
          <h1 className="text-3xl font-bold mb-1">Lesson Preview</h1>
          <p className="text-muted mb-6">{plan.name}</p>

          <div className="flex flex-col gap-3">
            <Button size="xl" onClick={() => setMode("lesson")} className="w-full">
              Start Quiz
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setMode("free_practice")}
              className="w-full"
            >
              Free Practice
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setMode("flashcard")}
              className="w-full"
            >
              Flashcards
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === "flashcard") {
    const cards = buildFlashcards();

    if (cards.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
          <Card padding="lg" className="max-w-sm text-center w-full">
            <div className="text-5xl mb-4">📇</div>
            <h2 className="text-2xl font-bold mb-2">No Flashcards Available</h2>
            <p className="text-muted mb-6">
              Flashcards aren&apos;t available for this lesson yet.
            </p>
            <Button onClick={() => setMode("welcome")}>Go Back</Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <FlashcardEngine
          cards={cards}
          keySignature={plan.key_signature}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  if (plan.plan_type === "key_signature_identification") {
    const config: KeySignatureQuizConfig = {
      keySignatures: plan.key_signatures ?? [],
      clef: plan.clef,
      questionsPerLesson: plan.questions_per_lesson,
      answerChoices: Math.min(plan.answer_choices, (plan.key_signatures ?? []).length || 4),
      mode,
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <KeySignatureQuizEngine
          config={config}
          onAttempt={() => {}}
          onComplete={() => {}}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  if (plan.plan_type === "symbol_concepts") {
    const config: SymbolQuizConfig = {
      symbols: (plan.symbols ?? []) as SymbolItem[],
      questionsPerLesson: plan.questions_per_lesson,
      answerChoices: Math.min(plan.answer_choices, (plan.symbols ?? []).length),
      mode,
      showHints: plan.show_hints ?? true,
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <SymbolQuizEngine
          config={config}
          onAttempt={() => {}}
          onComplete={() => {}}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  const config: QuizConfig = {
    notes: expandNotesWithAccidentals(
      plan.notes,
      plan.include_sharps ?? false,
      plan.include_flats ?? false,
    ),
    clef: plan.clef,
    keySignature: "",
    questionsPerLesson: plan.questions_per_lesson,
    answerChoices: plan.answer_choices,
    mode,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-2">
      <QuizEngine
        config={config}
        onAttempt={() => {}}
        onComplete={() => {}}
        onQuit={() => setMode("welcome")}
      />
    </div>
  );
}
