"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QuizEngine, type AttemptResult, type QuizConfig } from "@/components/music/QuizEngine";
import {
  FlashcardEngine,
  type FlashcardItem,
} from "@/components/music/FlashcardEngine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FlashcardState, SRSRating } from "@/lib/srs";
import { defaultFlashcardState, nextReviewDate } from "@/lib/srs";
import { shuffle } from "@/lib/music";

type Mode = "welcome" | "lesson" | "free_practice" | "flashcard";

interface PlanData {
  name: string;
  clef: "treble" | "bass" | "both";
  key_signature: string;
  questions_per_lesson: number;
  answer_choices: number;
  notes: string[];
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
      } catch {
        setError("Could not load your practice session.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const startSession = useCallback(
    async (m: "lesson" | "free_practice" | "flashcard") => {
      if (m === "flashcard") {
        try {
          const res = await fetch(`/api/practice/${token}/flashcards`);
          if (res.ok) {
            const data = await res.json();
            const planNotes: string[] = data.plan?.notes ?? plan?.notes ?? [];
            const clef = plan?.clef === "both" ? "treble" : (plan?.clef ?? "treble");

            const items: FlashcardItem[] = planNotes.map((note: string) => {
              const existing = data.progress?.find(
                (p: any) => p.note === note && p.clef === clef
              );
              return {
                note,
                clef: clef as "treble" | "bass",
                state: existing
                  ? {
                      easeFactor: existing.ease_factor,
                      intervalDays: existing.interval_days,
                      repetitions: existing.repetitions,
                    }
                  : defaultFlashcardState(),
              };
            });
            setFlashcardItems(shuffle(items));
          }
        } catch {
          // Fall through with empty flashcards
        }
        setMode("flashcard");
        return;
      }

      try {
        const res = await fetch(`/api/practice/${token}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: m }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);
        }
      } catch {
        // Continue even if session creation fails — offline-friendly
      }
      setMode(m);
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
    async (
      note: string,
      clef: "treble" | "bass",
      rating: SRSRating,
      newState: FlashcardState
    ) => {
      try {
        await fetch(`/api/practice/${token}/flashcards`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note,
            clef,
            easeFactor: newState.easeFactor,
            intervalDays: newState.intervalDays,
            repetitions: newState.repetitions,
            nextReview: nextReviewDate(newState.intervalDays).toISOString(),
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <FlashcardEngine
          cards={flashcardItems}
          keySignature={plan.key_signature}
          onReview={handleFlashcardReview}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  const quizConfig: QuizConfig = {
    notes: plan.notes,
    clef: plan.clef,
    keySignature: plan.key_signature,
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
