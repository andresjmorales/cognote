"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AppLoadingScreen } from "@/components/brand/AppLoadingScreen";
import { createClient } from "@/lib/supabase/client";
import type { AttemptResult, QuizConfig } from "@/components/music/QuizEngine";
import type { KeySignatureQuizConfig } from "@/components/music/KeySignatureQuizEngine";
import type { SymbolItem, SymbolQuizConfig } from "@/components/music/SymbolQuizEngine";
import type { FlashcardReviewData } from "@/components/music/FlashcardEngine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { LOADING_COPY } from "@/lib/ui-constants";
import { nextReviewDate } from "@/lib/srs";
import { expandNotesWithAccidentals } from "@/lib/music";
import {
  buildFlashcardItems,
  type FlashcardItem,
  type FlashcardProgressRow,
} from "@/lib/flashcards";

// Each plan type only ever uses one engine, so load engines on demand
// instead of shipping all four in the initial practice bundle.
const engineLoading = () => <AppLoadingScreen message={LOADING_COPY.default} />;
const QuizEngine = dynamic(
  () => import("@/components/music/QuizEngine").then((m) => m.QuizEngine),
  { ssr: false, loading: engineLoading }
);
const KeySignatureQuizEngine = dynamic(
  () =>
    import("@/components/music/KeySignatureQuizEngine").then(
      (m) => m.KeySignatureQuizEngine
    ),
  { ssr: false, loading: engineLoading }
);
const SymbolQuizEngine = dynamic(
  () => import("@/components/music/SymbolQuizEngine").then((m) => m.SymbolQuizEngine),
  { ssr: false, loading: engineLoading }
);
const FlashcardEngine = dynamic(
  () => import("@/components/music/FlashcardEngine").then((m) => m.FlashcardEngine),
  { ssr: false, loading: engineLoading }
);

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
  time_limit_seconds?: number;
}

export default function PracticePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("back") ?? "/lessons";
  const [studentName, setStudentName] = useState("");
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [mode, setMode] = useState<Mode>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashcardItems, setFlashcardItems] = useState<FlashcardItem[]>([]);
  const [flashcardsLoaded, setFlashcardsLoaded] = useState(false);
  const [startingSession, setStartingSession] = useState<
    "lesson" | "free_practice" | null
  >(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const { showToast } = useToast();

  // Warn once per visit when progress stops saving, instead of a toast on
  // every failed attempt (or the old behavior: nothing at all).
  const saveIssueNotifiedRef = useRef(false);
  const notifySaveIssue = useCallback(() => {
    if (saveIssueNotifiedRef.current) return;
    saveIssueNotifiedRef.current = true;
    showToast(
      "Hmm, we couldn't save your progress. You can keep practicing, but your teacher might not see today's results.",
      "info"
    );
  }, [showToast]);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setIsTeacher(!!data.session?.user);
    });
  }, []);

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
    async (m: "lesson" | "free_practice" | "flashcard") => {
      if (m === "flashcard") {
        setMode("flashcard");
        setFlashcardsLoaded(false);
        fetch(`/api/practice/${token}/flashcards`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data) {
              setFlashcardsLoaded(true);
              return;
            }
            const items: FlashcardItem[] = buildFlashcardItems(
              {
                plan_type: data.plan?.plan_type ?? "note_identification",
                clef: plan?.clef ?? "treble",
                notes: data.plan?.notes ?? plan?.notes ?? [],
                symbols: data.plan?.symbols ?? plan?.symbols ?? [],
                key_signatures:
                  data.plan?.key_signatures ?? plan?.key_signatures ?? [],
                include_sharps: plan?.include_sharps ?? false,
                include_flats: plan?.include_flats ?? false,
              },
              (data.progress ?? []) as FlashcardProgressRow[]
            );
            setFlashcardItems(items);
            setFlashcardsLoaded(true);
          })
          .catch(() => {
            setFlashcardsLoaded(true);
          });
        return;
      }

      setStartingSession(m);
      setSessionId(null);
      try {
        const res = await fetch(`/api/practice/${token}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: m }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);
        } else {
          // Quiz still works locally; attempts won't be logged.
          notifySaveIssue();
        }
      } catch {
        notifySaveIssue();
      }
      setStartingSession(null);
      setMode(m);
    },
    [token, plan, notifySaveIssue]
  );

  const handleAttempt = useCallback(
    async (attempt: AttemptResult) => {
      if (!sessionId) return;
      try {
        const res = await fetch(`/api/practice/${token}/session/${sessionId}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt),
        });
        if (!res.ok) notifySaveIssue();
      } catch {
        // Don't disrupt practice; warn once that progress isn't saving.
        notifySaveIssue();
      }
    },
    [token, sessionId, notifySaveIssue]
  );

  const handleComplete = useCallback(
    async (results: AttemptResult[]) => {
      const correct = results.filter((r) => r.isCorrect).length;
      setLastScore(`${correct}/${results.length}`);

      if (!sessionId) return;
      try {
        const res = await fetch(`/api/practice/${token}/session/${sessionId}/complete`, {
          method: "PUT",
        });
        if (!res.ok) notifySaveIssue();
      } catch {
        notifySaveIssue();
      }
    },
    [token, sessionId, notifySaveIssue]
  );

  const handleFlashcardReview = useCallback(
    async (data: FlashcardReviewData) => {
      try {
        const res = await fetch(`/api/practice/${token}/flashcards`, {
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
        if (!res.ok) notifySaveIssue();
      } catch {
        notifySaveIssue();
      }
    },
    [token, notifySaveIssue]
  );

  const teacherHomeButton = isTeacher && (
    <Link
      href={backHref}
      className="fixed top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-muted hover:text-foreground hover:bg-surface-dim transition-colors shadow-sm"
    >
      ← Home
    </Link>
  );

  function renderContent() {
    if (loading) {
      return <AppLoadingScreen message={LOADING_COPY.default} />;
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
                disabled={startingSession !== null}
                className="w-full"
              >
                {startingSession === "lesson" ? "Loading..." : "Start Quiz"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => startSession("free_practice")}
                disabled={startingSession !== null}
                className="w-full"
              >
                {startingSession === "free_practice"
                  ? "Loading..."
                  : "Free Practice"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => startSession("flashcard")}
                disabled={startingSession !== null}
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
      if (!flashcardsLoaded) {
        return <AppLoadingScreen message={LOADING_COPY.flashcards} />;
      }
      if (flashcardItems.length === 0) {
        return (
          <div className="min-h-screen flex items-center justify-center p-2 font-[family-name:var(--font-nunito)]">
            <Card padding="lg" className="max-w-sm text-center">
              <div className="text-5xl mb-4">📇</div>
              <h2 className="text-2xl font-bold mb-2">No Flashcards Available</h2>
              <p className="text-muted mb-6">
                Flashcards aren&apos;t available for this lesson type yet.
              </p>
              <Button onClick={() => { setFlashcardItems([]); setMode("welcome"); }}>
                Go Back
              </Button>
            </Card>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-2">
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
        timeLimitSeconds: plan.time_limit_seconds ?? 0,
      };
      return (
        <div className="min-h-screen flex items-center justify-center p-2">
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
        timeLimitSeconds: plan.time_limit_seconds ?? 0,
      };
      return (
        <div className="min-h-screen flex items-center justify-center p-2">
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
      timeLimitSeconds: plan.time_limit_seconds ?? 0,
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <QuizEngine
          config={quizConfig}
          onAttempt={handleAttempt}
          onComplete={handleComplete}
          onQuit={() => setMode("welcome")}
        />
      </div>
    );
  }

  return (
    <>
      {teacherHomeButton}
      {renderContent()}
    </>
  );
}
