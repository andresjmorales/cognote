"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QuizEngine, type AttemptResult, type QuizConfig } from "@/components/music/QuizEngine";
import {
  KeySignatureQuizEngine,
  type KeySignatureQuizConfig,
} from "@/components/music/KeySignatureQuizEngine";
import {
  SymbolQuizEngine,
  type SymbolItem,
  type SymbolQuizConfig,
} from "@/components/music/SymbolQuizEngine";
import {
  FlashcardEngine,
  type FlashcardItem,
  type FlashcardReviewData,
} from "@/components/music/FlashcardEngine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { defaultFlashcardState, nextReviewDate } from "@/lib/srs";
import { shuffle, expandNotesWithAccidentals } from "@/lib/music";

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

export default function PracticePage() {
  const { token } = useParams<{ token: string }>();
  const [studentName, setStudentName] = useState("");
  const [studentPlanId, setStudentPlanId] = useState("");
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [mode, setMode] = useState<Mode>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashcardItems, setFlashcardItems] = useState<FlashcardItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/practice/${token}`);
        if (!res.ok) {
          setError("This practice link doesn't seem to be valid.");
          return;
        }
        const data = await res.json();
        setStudentName(data.studentName);
        setStudentPlanId(data.studentPlanId);
        setPlan(data.plan);
        document.title = `CogNote - Practice`;
      } catch {
        setError("Could not load your practice session.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const startSession = useCallback(
    (m: "lesson" | "free_practice" | "flashcard") => {
      if (m === "flashcard") {
        setMode("flashcard");
        fetch(`/api/practice/${token}/flashcards`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data) return;
            const isSymbolPlan = data.plan?.plan_type === "symbol_concepts";

            let items: FlashcardItem[];
            if (isSymbolPlan) {
              const symbols: SymbolItem[] = data.plan?.symbols ?? plan?.symbols ?? [];
              items = symbols.map((sym) => {
                const existing = data.progress?.find(
                  (p: any) => p.item_type === "symbol" && p.note === sym.id
                );
                return {
                  itemType: "symbol" as const,
                  symbolId: sym.id,
                  symbol: sym.symbol,
                  term: sym.term,
                  definition: sym.definition,
                  state: existing
                    ? {
                        easeFactor: existing.ease_factor,
                        intervalDays: existing.interval_days,
                        repetitions: existing.repetitions,
                      }
                    : defaultFlashcardState(),
                };
              });
            } else {
              const planNotes: string[] = data.plan?.notes ?? plan?.notes ?? [];
              const expandedNotes = expandNotesWithAccidentals(
                planNotes,
                plan?.include_sharps ?? false,
                plan?.include_flats ?? false,
              );
              const clefs: ("treble" | "bass")[] =
                plan?.clef === "both"
                  ? ["treble", "bass"]
                  : [plan?.clef ?? "treble"];

              items = [];
              for (const noteVal of expandedNotes) {
                for (const clefVal of clefs) {
                  const existing = data.progress?.find(
                    (p: any) => p.note === noteVal && p.clef === clefVal && (p.item_type === "note" || !p.item_type)
                  );
                  items.push({
                    itemType: "note" as const,
                    note: noteVal,
                    clef: clefVal,
                    state: existing
                      ? {
                          easeFactor: existing.ease_factor,
                          intervalDays: existing.interval_days,
                          repetitions: existing.repetitions,
                        }
                      : defaultFlashcardState(),
                  });
                }
              }
            }
            setFlashcardItems(shuffle(items));
          })
          .catch(() => {});
        return;
      }

      setMode(m);
      fetch(`/api/practice/${token}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: m }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setSessionId(data.sessionId);
        })
        .catch(() => {});
    },
    [token, plan]
  );

  const handleAttempt = useCallback(
    async (attempt: AttemptResult) => {
      if (!sessionId) return;
      try {
        await fetch(`/api/practice/${token}/session/${sessionId}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt),
        });
      } catch {
        // Silent failure — don't disrupt practice
      }
    },
    [token, sessionId]
  );

  const handleComplete = useCallback(
    async (results: AttemptResult[]) => {
      const correct = results.filter((r) => r.isCorrect).length;
      setLastScore(`${correct}/${results.length}`);

      if (!sessionId) return;
      try {
        await fetch(`/api/practice/${token}/session/${sessionId}/complete`, {
          method: "PUT",
        });
      } catch {
        // Silent
      }
    },
    [token, sessionId]
  );

  const handleFlashcardReview = useCallback(
    async (data: FlashcardReviewData) => {
      try {
        await fetch(`/api/practice/${token}/flashcards`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: data.itemType,
            itemId: data.itemId,
            clef: data.clef,
            easeFactor: data.newState.easeFactor,
            intervalDays: data.newState.intervalDays,
            repetitions: data.newState.repetitions,
            nextReview: nextReviewDate(data.newState.intervalDays).toISOString(),
          }),
        });
      } catch {
        // Silent
      }
    },
    [token]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-[family-name:var(--font-nunito)]">
        <div className="text-xl text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
        <Card padding="lg" className="max-w-md text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-2">Oops!</h1>
          <p className="text-muted">{error ?? "Something went wrong."}</p>
        </Card>
      </div>
    );
  }

  if (mode === "welcome") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
        <Card padding="lg" className="max-w-sm text-center w-full">
          <div className="text-5xl mb-2">🎵</div>
          <h1 className="text-3xl font-bold mb-1">
            Hi {studentName}!
          </h1>
          <p className="text-muted mb-6">{plan.name}</p>
          {lastScore && (
            <p className="text-sm text-muted mb-4">
              Last time: {lastScore} ✨
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              size="xl"
              onClick={() => startSession("lesson")}
              className="w-full"
            >
              Start Lesson
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => startSession("free_practice")}
              className="w-full"
            >
              Free Practice
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => startSession("flashcard")}
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
    if (flashcardItems.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center font-[family-name:var(--font-nunito)]">
          <div className="text-xl text-muted animate-pulse">Loading flashcards...</div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <FlashcardEngine
          cards={flashcardItems}
          keySignature={plan.key_signature}
          onReview={handleFlashcardReview}
          onQuit={() => { setFlashcardItems([]); setMode("welcome"); }}
        />
      </div>
    );
  }

  if (plan.plan_type === "key_signature_identification") {
    const keySigConfig: KeySignatureQuizConfig = {
      keySignatures: plan.key_signatures ?? [],
      clef: plan.clef,
      questionsPerLesson: plan.questions_per_lesson,
      answerChoices: Math.min(plan.answer_choices, (plan.key_signatures ?? []).length || 4),
      mode: mode as "lesson" | "free_practice",
    };
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <KeySignatureQuizEngine
          config={keySigConfig}
          onAttempt={handleAttempt}
          onComplete={handleComplete}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  if (plan.plan_type === "symbol_concepts") {
    const symbolConfig: SymbolQuizConfig = {
      symbols: (plan.symbols ?? []) as SymbolItem[],
      questionsPerLesson: plan.questions_per_lesson,
      answerChoices: Math.min(plan.answer_choices, (plan.symbols ?? []).length),
      mode: mode as "lesson" | "free_practice",
      showHints: plan.show_hints ?? true,
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SymbolQuizEngine
          config={symbolConfig}
          onAttempt={handleAttempt}
          onComplete={handleComplete}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  const quizConfig: QuizConfig = {
    notes: expandNotesWithAccidentals(
      plan.notes,
      plan.include_sharps ?? false,
      plan.include_flats ?? false,
    ),
    clef: plan.clef,
    keySignature: "", // Don't show key signature on staff for note-ID (accidentals still on notes)
    questionsPerLesson: plan.questions_per_lesson,
    answerChoices: plan.answer_choices,
    mode: mode as "lesson" | "free_practice",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <QuizEngine
        config={quizConfig}
        onAttempt={handleAttempt}
        onComplete={handleComplete}
        onQuit={() => setMode("welcome")}
      />
    </div>
  );
}
