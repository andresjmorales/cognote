"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuestionTimer, TIMEOUT_ANSWER } from "./QuestionTimer";
import { shuffleAvoidingFirst } from "@/lib/music";

/**
 * Shared state machine and screens for the three quiz engines
 * (note identification, key signatures, symbols). Each engine supplies
 * its question prompt, answer choices, and display formatting; everything
 * else (question bag, phases, scoring, timing, feedback delays, the
 * complete screen, and the empty-pool guard) lives here.
 */

export interface AttemptResult {
  noteDisplayed: string;
  clef: "treble" | "bass";
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export type QuizPhase = "playing" | "feedback" | "complete";

const FEEDBACK_MS_CORRECT = 800;
const FEEDBACK_MS_INCORRECT = 1500;

export function useQuizCore<T>({
  items,
  questionsPerLesson,
  isLesson,
  onAttempt,
  onComplete,
}: {
  items: T[];
  questionsPerLesson: number;
  isLesson: boolean;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [phase, setPhase] = useState<QuizPhase>("playing");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Shuffled "bag" so every item appears before any repeats.
  const bagRef = useRef<T[]>([]);
  const bagIndexRef = useRef(0);
  const lastShownRef = useRef<T | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentItem = useMemo(() => {
    if (items.length === 0) return undefined;
    if (bagRef.current.length === 0 || bagIndexRef.current >= bagRef.current.length) {
      bagRef.current = shuffleAvoidingFirst(items, lastShownRef.current);
      bagIndexRef.current = 0;
    }
    const item = bagRef.current[bagIndexRef.current];
    bagIndexRef.current++;
    lastShownRef.current = item;
    return item;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, items]);

  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [questionIndex]);

  // Don't advance to the next question after the quiz has unmounted
  // (student quit mid-feedback).
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const submitAnswer = useCallback(
    (attempt: AttemptResult) => {
      if (phase !== "playing") return;

      setSelectedAnswer(attempt.studentAnswer);
      setResults((prev) => [...prev, attempt]);
      setPhase("feedback");
      onAttempt?.(attempt);

      advanceTimerRef.current = setTimeout(
        () => {
          const nextIndex = questionIndex + 1;
          if (isLesson && nextIndex >= questionsPerLesson) {
            setPhase("complete");
            onComplete?.([...results, attempt]);
          } else {
            setQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setPhase("playing");
          }
        },
        attempt.isCorrect ? FEEDBACK_MS_CORRECT : FEEDBACK_MS_INCORRECT
      );
    },
    [
      phase,
      questionIndex,
      questionsPerLesson,
      isLesson,
      results,
      onAttempt,
      onComplete,
    ]
  );

  const restart = useCallback(() => {
    setQuestionIndex(0);
    setResults([]);
    setSelectedAnswer(null);
    setPhase("playing");
  }, []);

  return {
    questionIndex,
    results,
    phase,
    selectedAnswer,
    questionStartTime,
    currentItem,
    submitAnswer,
    restart,
    correctCount: results.filter((r) => r.isCorrect).length,
    incorrectCount: results.filter((r) => !r.isCorrect).length,
  };
}

export function QuizCompleteCard({
  results,
  praiseHigh,
  praiseGood = "Great job! Keep practicing!",
  onRestart,
  onQuit,
}: {
  results: AttemptResult[];
  /** Shown for scores of 90%+, e.g. "You're a music reading star!" */
  praiseHigh: string;
  praiseGood?: string;
  onRestart: () => void;
  onQuit?: () => void;
}) {
  const total = results.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Card
      padding="lg"
      className="max-w-lg w-full mx-auto text-center font-[family-name:var(--font-nunito)]"
    >
      <div className="text-6xl mb-4">
        {pct >= 90 ? "🎉" : pct >= 70 ? "⭐" : pct >= 50 ? "👍" : "💪"}
      </div>
      <h2 className="text-3xl font-bold mb-2">
        {correct} out of {total}!
      </h2>
      <p className="text-lg text-muted mb-6">
        {pct >= 90
          ? `Amazing! ${praiseHigh}`
          : pct >= 70
            ? praiseGood
            : pct >= 50
              ? "Good effort! You're getting better!"
              : "Keep at it! Practice makes perfect!"}
      </p>
      <div className="flex gap-3 justify-center">
        <Button size="lg" onClick={onRestart}>
          Redo Lesson
        </Button>
        {onQuit && (
          <Button size="lg" variant="secondary" onClick={onQuit}>
            Done
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Kid-friendly guard for plans whose question pool is empty. */
export function QuizEmptyCard({ onQuit }: { onQuit?: () => void }) {
  return (
    <Card
      padding="lg"
      className="max-w-lg w-full mx-auto text-center font-[family-name:var(--font-nunito)]"
    >
      <div className="text-5xl mb-4">🎼</div>
      <h2 className="text-2xl font-bold mb-2">Nothing to practice yet</h2>
      <p className="text-muted mb-6">
        This lesson doesn&apos;t have any questions yet. Ask your teacher to
        add some!
      </p>
      {onQuit && (
        <Button variant="secondary" onClick={onQuit}>
          Go Back
        </Button>
      )}
    </Card>
  );
}

export function QuizShell({
  isLesson,
  questionIndex,
  questionsPerLesson,
  timeLimitSeconds,
  phase,
  correctCount,
  incorrectCount,
  prompt,
  beforeChoices,
  choices,
  correctAnswer,
  selectedAnswer,
  renderChoice,
  choiceClassName = "text-lg font-bold",
  onAnswer,
  onQuit,
}: {
  isLesson: boolean;
  questionIndex: number;
  questionsPerLesson: number;
  /** Seconds per question in lesson mode; 0/undefined = untimed. */
  timeLimitSeconds?: number;
  phase: QuizPhase;
  correctCount: number;
  incorrectCount: number;
  /** The question card (staff, symbol, definition, ...). */
  prompt: ReactNode;
  /** Timeout / hint copy rendered between the prompt and the choices. */
  beforeChoices?: ReactNode;
  choices: string[];
  correctAnswer: string;
  selectedAnswer: string | null;
  renderChoice: (choice: string) => ReactNode;
  choiceClassName?: string;
  onAnswer: (choice: string) => void;
  onQuit?: () => void;
}) {
  const isTimed = isLesson && (timeLimitSeconds ?? 0) > 0;

  return (
    <div className="max-w-lg w-full mx-auto font-[family-name:var(--font-nunito)]">
      {isLesson && (
        <ProgressBar
          current={questionIndex + 1}
          total={questionsPerLesson}
          className="mb-4"
        />
      )}

      {isTimed && (
        <QuestionTimer
          key={questionIndex}
          seconds={timeLimitSeconds!}
          paused={phase !== "playing"}
          onExpire={() => onAnswer(TIMEOUT_ANSWER)}
        />
      )}

      <div className="flex justify-between items-center text-sm mb-3">
        <span className="text-success font-semibold">✓ {correctCount}</span>
        <span className="text-error font-semibold">✗ {incorrectCount}</span>
      </div>

      {prompt}

      {beforeChoices}

      <div className="grid grid-cols-2 gap-3">
        {choices.map((choice) => {
          let variant: "secondary" | "success" | "error" = "secondary";
          if (phase === "feedback") {
            if (choice === correctAnswer) variant = "success";
            else if (choice === selectedAnswer) variant = "error";
          }

          return (
            <Button
              key={choice}
              variant={variant}
              size="xl"
              disabled={phase === "feedback"}
              onClick={() => onAnswer(choice)}
              className={choiceClassName}
            >
              {renderChoice(choice)}
            </Button>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={onQuit}>
          {isLesson ? "Quit Quiz" : "I\u0027m Done"}
        </Button>
      </div>
    </div>
  );
}
