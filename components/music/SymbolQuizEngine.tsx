"use client";

import { useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { shuffle } from "@/lib/music";
import { SymbolDisplay } from "./VexFlowSymbol";
import { TIMEOUT_ANSWER } from "./QuestionTimer";
import {
  QuizCompleteCard,
  QuizEmptyCard,
  QuizShell,
  useQuizCore,
  type AttemptResult,
} from "./quiz-core";

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
  /** Seconds allowed per question in lesson mode; 0/undefined = untimed. */
  timeLimitSeconds?: number;
}

interface SymbolQuizEngineProps {
  config: SymbolQuizConfig;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
  onQuit?: () => void;
}

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

/** Term-only entries quiz the definition instead of the glyph. */
function symbolMatchesTerm(sym: SymbolItem): boolean {
  return sym.symbol.toLowerCase().trim() === sym.term.toLowerCase().trim();
}

export function SymbolQuizEngine({
  config,
  onAttempt,
  onComplete,
  onQuit,
}: SymbolQuizEngineProps) {
  const { symbols, questionsPerLesson, answerChoices, mode, showHints = true, timeLimitSeconds } =
    config;
  const isLesson = mode === "lesson";

  const core = useQuizCore<SymbolItem>({
    items: symbols,
    questionsPerLesson,
    isLesson,
    onAttempt,
    onComplete,
  });
  const { currentItem: currentSymbol, questionIndex, phase, selectedAnswer } = core;

  const choices = useMemo(
    () =>
      currentSymbol
        ? buildSymbolChoices(currentSymbol.term, symbols, answerChoices)
        : [],
    [currentSymbol, symbols, answerChoices]
  );

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentSymbol) return;
      core.submitAnswer({
        noteDisplayed: currentSymbol.id,
        clef: "treble",
        correctAnswer: currentSymbol.term,
        studentAnswer: answer,
        isCorrect: answer === currentSymbol.term,
        responseTimeMs: Date.now() - core.questionStartTime,
      });
    },
    [core, currentSymbol]
  );

  if (!currentSymbol) {
    return <QuizEmptyCard onQuit={onQuit} />;
  }

  if (phase === "complete") {
    return (
      <QuizCompleteCard
        results={core.results}
        praiseHigh="You know your musical terms!"
        praiseGood="Great job! Keep learning!"
        onRestart={core.restart}
        onQuit={onQuit}
      />
    );
  }

  return (
    <QuizShell
      isLesson={isLesson}
      questionIndex={questionIndex}
      questionsPerLesson={questionsPerLesson}
      timeLimitSeconds={timeLimitSeconds}
      phase={phase}
      correctCount={core.correctCount}
      incorrectCount={core.incorrectCount}
      prompt={
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
      }
      beforeChoices={
        phase === "feedback" && selectedAnswer === TIMEOUT_ANSWER ? (
          <p className="text-center text-error font-semibold mb-3">
            ⏱️ Time&apos;s up! The answer was {currentSymbol.term}.
          </p>
        ) : (
          <p className="text-center text-sm text-muted mb-3">
            {symbolMatchesTerm(currentSymbol)
              ? "Pick the correct term:"
              : "What is this called?"}
          </p>
        )
      }
      choices={choices}
      correctAnswer={currentSymbol.term}
      selectedAnswer={selectedAnswer}
      renderChoice={(choice) => choice}
      onAnswer={handleAnswer}
      onQuit={onQuit}
    />
  );
}
