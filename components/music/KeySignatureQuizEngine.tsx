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
  buildKeySigAnswerChoices,
  displayKeySignatureName,
  KEY_SIGNATURES,
} from "@/lib/music";

export interface KeySignatureQuizConfig {
  keySignatures: string[];
  clef: "treble" | "bass" | "both";
  questionsPerLesson: number;
  answerChoices: number;
  mode: "lesson" | "free_practice";
  /** Seconds allowed per question in lesson mode; 0/undefined = untimed. */
  timeLimitSeconds?: number;
}

interface KeySignatureQuizEngineProps {
  config: KeySignatureQuizConfig;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
  onQuit?: () => void;
}

export function KeySignatureQuizEngine({
  config,
  onAttempt,
  onComplete,
  onQuit,
}: KeySignatureQuizEngineProps) {
  const { keySignatures, clef, questionsPerLesson, answerChoices, mode, timeLimitSeconds } = config;
  const isLesson = mode === "lesson";

  const core = useQuizCore<string>({
    items: keySignatures,
    questionsPerLesson,
    isLesson,
    onAttempt,
    onComplete,
  });
  const { currentItem: currentKey, questionIndex, phase, selectedAnswer } = core;

  const currentClef = useMemo((): "treble" | "bass" => {
    if (clef === "both") return Math.random() > 0.5 ? "treble" : "bass";
    return clef;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, clef]);

  const choices = useMemo(
    () =>
      currentKey
        ? buildKeySigAnswerChoices(currentKey, keySignatures, answerChoices)
        : [],
    [currentKey, keySignatures, answerChoices]
  );

  const correctAnswer = currentKey ?? "";

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentKey) return;
      core.submitAnswer({
        noteDisplayed: currentKey,
        clef: currentClef,
        correctAnswer,
        studentAnswer: answer,
        isCorrect: answer === correctAnswer,
        responseTimeMs: Date.now() - core.questionStartTime,
      });
    },
    [core, currentKey, currentClef, correctAnswer]
  );

  if (!currentKey) {
    return <QuizEmptyCard onQuit={onQuit} />;
  }

  if (phase === "complete") {
    return (
      <QuizCompleteCard
        results={core.results}
        praiseHigh="You know your key signatures!"
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
            clef={currentClef}
            keySignature={KEY_SIGNATURES[currentKey] ?? "C"}
          />
        </Card>
      }
      beforeChoices={
        phase === "feedback" && selectedAnswer === TIMEOUT_ANSWER ? (
          <p className="text-center text-error font-semibold mb-3">
            ⏱️ Time&apos;s up! The answer was {displayKeySignatureName(correctAnswer)}.
          </p>
        ) : undefined
      }
      choices={choices}
      correctAnswer={correctAnswer}
      selectedAnswer={selectedAnswer}
      renderChoice={(choice) => displayKeySignatureName(choice)}
      onAnswer={handleAnswer}
      onQuit={onQuit}
    />
  );
}
