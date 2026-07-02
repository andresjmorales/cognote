"use client";

import { useEffect, useState } from "react";

const TIMER_TICK_MS = 100;
const TIMER_WARNING_SECONDS = 3;
const MS_PER_SECOND = 1000;

/** Recorded as the student answer when the question timer expires. */
export const TIMEOUT_ANSWER = "(no answer)";

interface QuestionTimerProps {
  /** Total seconds allowed for the current question. */
  seconds: number;
  /** Pause the countdown (e.g. during answer feedback). */
  paused: boolean;
  onExpire: () => void;
}

/**
 * Countdown bar for timed quizzes. Mount with key={questionIndex} so the
 * timer resets for each new question.
 */
export function QuestionTimer({ seconds, paused, onExpire }: QuestionTimerProps) {
  const [remainingMs, setRemainingMs] = useState(seconds * MS_PER_SECOND);

  useEffect(() => {
    if (paused || remainingMs <= 0) return;
    const deadline = Date.now() + remainingMs;
    const interval = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, TIMER_TICK_MS);
    return () => clearInterval(interval);
    // Restart only when pausing/unpausing; remainingMs is carried over via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const fraction = remainingMs / (seconds * MS_PER_SECOND);
  const secondsLeft = Math.ceil(remainingMs / MS_PER_SECOND);
  const warning = secondsLeft <= TIMER_WARNING_SECONDS;

  return (
    <div className="flex items-center gap-2 mb-3">
      <span aria-hidden>⏱️</span>
      <div className="flex-1 h-2 rounded-full bg-surface-dim overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            warning ? "bg-error" : "bg-primary"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span
        className={`text-sm font-bold tabular-nums w-8 text-right ${
          warning ? "text-error" : "text-muted"
        }`}
      >
        {secondsLeft}s
      </span>
    </div>
  );
}
