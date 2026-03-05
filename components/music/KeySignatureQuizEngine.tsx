"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffRenderer } from "./StaffRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  buildKeySigAnswerChoices,
  displayKeySignatureName,
  shuffleAvoidingFirst,
  KEY_SIGNATURES,
} from "@/lib/music";
import type { AttemptResult } from "./QuizEngine";

export interface KeySignatureQuizConfig {
  keySignatures: string[];
  clef: "treble" | "bass" | "both";
  questionsPerLesson: number;
  answerChoices: number;
  mode: "lesson" | "free_practice";
}

interface KeySignatureQuizEngineProps {
  config: KeySignatureQuizConfig;
  onAttempt?: (attempt: AttemptResult) => void;
  onComplete?: (results: AttemptResult[]) => void;
  onQuit?: () => void;
}

type Phase = "playing" | "feedback" | "complete";

export function KeySignatureQuizEngine({
  config,
  onAttempt,
  onComplete,
  onQuit,
}: KeySignatureQuizEngineProps) {
  const { keySignatures, clef, questionsPerLesson, answerChoices, mode } = config;
  const isLesson = mode === "lesson";

  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const bagRef = useRef<string[]>([]);
  const bagIndexRef = useRef(0);
  const lastShownRef = useRef<string | null>(null);

  const currentKey = useMemo(() => {
    if (bagRef.current.length === 0 || bagIndexRef.current >= bagRef.current.length) {
      bagRef.current = shuffleAvoidingFirst(keySignatures, lastShownRef.current);
      bagIndexRef.current = 0;
    }
    const keyName = bagRef.current[bagIndexRef.current];
    bagIndexRef.current++;
    lastShownRef.current = keyName;
    return keyName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, keySignatures]);

  const currentClef = useMemo((): "treble" | "bass" => {
    if (clef === "both") return Math.random() > 0.5 ? "treble" : "bass";
    return clef;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, clef]);

  const choices = useMemo(
    () => buildKeySigAnswerChoices(currentKey, keySignatures, answerChoices),
    [currentKey, keySignatures, answerChoices]
  );

  const vexKeySignature = KEY_SIGNATURES[currentKey] ?? "C";
  const correctAnswer = currentKey;
  const correctCount = results.filter((r) => r.isCorrect).length;
  const incorrectCount = results.filter((r) => !r.isCorrect).length;

  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [questionIndex]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (phase !== "playing") return;

      const isCorrect = answer === correctAnswer;
      const attempt: AttemptResult = {
        noteDisplayed: currentKey,
        clef: currentClef,
        correctAnswer,
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
      correctAnswer,
      currentKey,
      currentClef,
      questionStartTime,
      questionIndex,
      questionsPerLesson,
      isLesson,
      results,
      onAttempt,
      onComplete,
    ]
  );

  if (phase === "complete") {
    const total = results.length;
    const correct = results.filter((r) => r.isCorrect).length;
    const pct = Math.round((correct / total) * 100);

    return (
      <Card padding="lg" className="max-w-lg w-full mx-auto text-center font-[family-name:var(--font-nunito)]">
        <div className="text-6xl mb-4">
          {pct >= 90 ? "🎉" : pct >= 70 ? "⭐" : pct >= 50 ? "👍" : "💪"}
        </div>
        <h2 className="text-3xl font-bold mb-2">
          {correct} out of {total}!
        </h2>
        <p className="text-lg text-muted mb-6">
          {pct >= 90
            ? "Amazing! You know your key signatures!"
            : pct >= 70
              ? "Great job! Keep practicing!"
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

      <Card className="mb-6 flex items-center justify-center">
        <StaffRenderer
          clef={currentClef}
          keySignature={vexKeySignature}
        />
      </Card>

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
              onClick={() => handleAnswer(choice)}
              className="text-lg font-bold"
            >
              {displayKeySignatureName(choice)}
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
