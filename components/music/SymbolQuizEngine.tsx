"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { shuffle, shuffleAvoidingFirst } from "@/lib/music";
import { SymbolDisplay } from "./VexFlowSymbol";
import type { AttemptResult } from "./QuizEngine";

export interface SymbolItem {
  id: string;
  symbol: string;
  term: string;
  definition: string;
}

export interface SymbolQuizConfig {
  symbols: SymbolItem[];
  questionsPerLesson: number;
  answerChoices: number;
  mode: "lesson" | "free_practice";
  showHints?: boolean;
}

interface SymbolQuizEngineProps {
  config: SymbolQuizConfig;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
  onQuit?: () => void;
}

type Phase = "playing" | "feedback" | "complete";

function buildSymbolChoices(
  correctTerm: string,
  pool: SymbolItem[],
  totalChoices: number
): string[] {
  const distractors = pool
    .filter((s) => s.term !== correctTerm)
    .map((s) => s.term);
  const unique = [...new Set(distractors)];
  const picked = shuffle(unique).slice(0, totalChoices - 1);
  return shuffle([correctTerm, ...picked]);
}

function symbolMatchesTerm(sym: SymbolItem): boolean {
  return sym.symbol.toLowerCase().trim() === sym.term.toLowerCase().trim();
}

export function SymbolQuizEngine({
  config,
  onAttempt,
  onComplete,
  onQuit,
}: SymbolQuizEngineProps) {
  const { symbols, questionsPerLesson, answerChoices, mode, showHints = true } = config;
  const isLesson = mode === "lesson";

  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const bagRef = useRef<SymbolItem[]>([]);
  const bagIndexRef = useRef(0);
  const lastShownRef = useRef<SymbolItem | null>(null);

  const currentSymbol = useMemo(() => {
    if (bagRef.current.length === 0 || bagIndexRef.current >= bagRef.current.length) {
      bagRef.current = shuffleAvoidingFirst(symbols, lastShownRef.current);
      bagIndexRef.current = 0;
    }
    const sym = bagRef.current[bagIndexRef.current];
    bagIndexRef.current++;
    lastShownRef.current = sym;
    return sym;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, symbols]);

  const choices = useMemo(
    () => buildSymbolChoices(currentSymbol.term, symbols, answerChoices),
    [currentSymbol, symbols, answerChoices]
  );

  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [questionIndex]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (phase !== "playing") return;

      const isCorrect = answer === currentSymbol.term;
      const attempt: AttemptResult = {
        noteDisplayed: currentSymbol.id,
        clef: "treble",
        correctAnswer: currentSymbol.term,
        studentAnswer: answer,
        isCorrect,
        responseTimeMs: Date.now() - questionStartTime,
      };

      setSelectedAnswer(answer);
      setResults((prev) => [...prev, attempt]);
      setPhase("feedback");
      onAttempt?.(attempt);

      setTimeout(
        () => {
          const nextIndex = questionIndex + 1;
          if (isLesson && nextIndex >= questionsPerLesson) {
            const allResults = [...results, attempt];
            setPhase("complete");
            onComplete?.(allResults);
          } else {
            setQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setPhase("playing");
          }
        },
        isCorrect ? 800 : 1500
      );
    },
    [
      phase,
      currentSymbol,
      questionStartTime,
      questionIndex,
      questionsPerLesson,
      isLesson,
      results,
      onAttempt,
      onComplete,
    ]
  );

  const correctCount = results.filter((r) => r.isCorrect).length;
  const incorrectCount = results.filter((r) => !r.isCorrect).length;

  if (phase === "complete") {
    const total = results.length;
    const correct = results.filter((r) => r.isCorrect).length;
    const pct = Math.round((correct / total) * 100);

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
            ? "Amazing! You know your musical terms!"
            : pct >= 70
              ? "Great job! Keep learning!"
              : pct >= 50
                ? "Good effort! You're getting better!"
                : "Keep at it! Practice makes perfect!"}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => {
              setQuestionIndex(0);
              setResults([]);
              setSelectedAnswer(null);
              setPhase("playing");
            }}
          >
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

  return (
    <div className="max-w-lg w-full mx-auto font-[family-name:var(--font-nunito)]">
      {isLesson && (
        <ProgressBar
          current={questionIndex + 1}
          total={questionsPerLesson}
          className="mb-4"
        />
      )}

      <div className="flex justify-between items-center text-sm mb-3">
        <span className="text-success font-semibold">✓ {correctCount}</span>
        <span className="text-error font-semibold">✗ {incorrectCount}</span>
      </div>

      <Card padding="lg" className="mb-6 text-center">
        {symbolMatchesTerm(currentSymbol) ? (
          <>
            <p className="text-lg text-muted mb-1">Which term means...</p>
            <div className="text-2xl font-bold">{currentSymbol.definition}</div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center mb-2">
              <SymbolDisplay
                symbolId={currentSymbol.id}
                symbolText={currentSymbol.symbol}
              />
            </div>
            {showHints && (
              <p className="text-sm text-muted">{currentSymbol.definition}</p>
            )}
          </>
        )}
      </Card>

      <p className="text-center text-sm text-muted mb-3">
        {symbolMatchesTerm(currentSymbol) ? "Pick the correct term:" : "What is this called?"}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {choices.map((choice) => {
          let variant: "secondary" | "success" | "error" = "secondary";
          if (phase === "feedback") {
            if (choice === currentSymbol.term) variant = "success";
            else if (choice === selectedAnswer) variant = "error";
          }

          return (
            <Button
              key={choice}
              variant={variant}
              size="xl"
              disabled={phase === "feedback"}
              onClick={() => handleAnswer(choice)}
              className="text-lg font-bold"
            >
              {choice}
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
