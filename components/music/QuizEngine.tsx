"use client";

import { useCallback, useMemo } from "react";
import { StaffRenderer } from "./StaffRenderer";
import { TIMEOUT_ANSWER } from "./QuestionTimer";
import { Card } from "@/components/ui/card";
import {
  QuizCompleteCard,
  QuizEmptyCard,
  QuizShell,
  useQuizCore,
  type AttemptResult,
} from "./quiz-core";
import {
  buildAnswerChoices,
  noteName,
  displayNoteName,
  KEY_SIGNATURES,
} from "@/lib/music";

export type { AttemptResult };

export interface QuizConfig {
  notes: string[];
  clef: "treble" | "bass" | "both";
  keySignature: string;
  questionsPerLesson: number;
  answerChoices: number;
  mode: "lesson" | "free_practice";
  /** Seconds allowed per question in lesson mode; 0/undefined = untimed. */
  timeLimitSeconds?: number;
}

interface QuizEngineProps {
  config: QuizConfig;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
  onQuit?: () => void;
}

export function QuizEngine({
  config,
  onAttempt,
  onComplete,
  onQuit,
}: QuizEngineProps) {
  const { notes, clef, keySignature, questionsPerLesson, answerChoices, mode, timeLimitSeconds } =
    config;
  const isLesson = mode === "lesson";

  const core = useQuizCore<string>({
    items: notes,
    questionsPerLesson,
    isLesson,
    onAttempt,
    onComplete,
  });
  const { currentItem: currentNote, questionIndex, phase, selectedAnswer } = core;

  const currentClef = useMemo((): "treble" | "bass" => {
    if (clef === "both") return Math.random() > 0.5 ? "treble" : "bass";
    return clef;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, clef]);

  const choices = useMemo(
    () => (currentNote ? buildAnswerChoices(currentNote, notes, answerChoices) : []),
    [currentNote, notes, answerChoices]
  );

  const correctAnswer = currentNote ? noteName(currentNote) : "";

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentNote) return;
      core.submitAnswer({
        noteDisplayed: currentNote,
        clef: currentClef,
        correctAnswer,
        studentAnswer: answer,
        isCorrect: answer === correctAnswer,
        responseTimeMs: Date.now() - core.questionStartTime,
      });
    },
    [core, currentNote, currentClef, correctAnswer]
  );

  if (!currentNote) {
    return <QuizEmptyCard onQuit={onQuit} />;
  }

  if (phase === "complete") {
    return (
      <QuizCompleteCard
        results={core.results}
        praiseHigh="You're a music reading star!"
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
        <Card className="mb-6 flex items-center justify-center">
          <StaffRenderer
            note={currentNote}
            clef={currentClef}
            keySignature={KEY_SIGNATURES[keySignature] ?? "C"}
          />
        </Card>
      }
      beforeChoices={
        phase === "feedback" && selectedAnswer === TIMEOUT_ANSWER ? (
          <p className="text-center text-error font-semibold mb-3">
            ⏱️ Time&apos;s up! The answer was {displayNoteName(correctAnswer)}.
          </p>
        ) : undefined
      }
      choices={choices}
      correctAnswer={correctAnswer}
      selectedAnswer={selectedAnswer}
      renderChoice={(choice) => displayNoteName(choice)}
      choiceClassName="text-2xl font-bold"
      onAnswer={handleAnswer}
      onQuit={onQuit}
    />
  );
}
