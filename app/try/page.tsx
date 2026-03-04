"use client";

import { useState } from "react";
import Link from "next/link";
import { QuizEngine, type QuizConfig } from "@/components/music/QuizEngine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NOTE_PRESETS } from "@/lib/music";

type Screen = "pick" | "quiz";

const PRESET_OPTIONS = [
  { label: "Middle C Position", preset: "Middle C Position", clef: "treble" as const, description: "C D E F G — great for beginners" },
  { label: "Treble Staff Lines", preset: "Treble Staff (lines)", clef: "treble" as const, description: "E G B D F — Every Good Boy Does Fine" },
  { label: "Treble Staff Spaces", preset: "Treble Staff (spaces)", clef: "treble" as const, description: "F A C E — the spaces spell FACE" },
  { label: "Bass Staff Lines", preset: "Bass Staff (lines)", clef: "bass" as const, description: "G B D F A — Good Boys Do Fine Always" },
  { label: "Bass Staff Spaces", preset: "Bass Staff (spaces)", clef: "bass" as const, description: "A C E G — All Cows Eat Grass" },
];

export default function TryQuizPage() {
  const [screen, setScreen] = useState<Screen>("pick");
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);

  function startQuiz(presetKey: string, clef: "treble" | "bass") {
    const notes = NOTE_PRESETS[presetKey];
    if (!notes) return;
    setQuizConfig({
      notes,
      clef,
      keySignature: "C major",
      questionsPerLesson: 10,
      answerChoices: 4,
      mode: "lesson",
    });
    setScreen("quiz");
  }

  if (screen === "quiz" && quizConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
        <QuizEngine
          config={quizConfig}
          onQuit={() => setScreen("pick")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-[family-name:var(--font-nunito)]">
      <header className="border-b border-border bg-surface shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight">
            <img src="/icon/cognote.svg" alt="" className="h-8 w-8" width={32} height={32} />
            CogNote
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎵</div>
            <h1 className="text-3xl font-bold mb-2">Try a Quiz</h1>
            <p className="text-muted">
              Pick a set of notes and test your music reading skills!
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PRESET_OPTIONS.map((opt) => (
              <Card key={opt.preset} className="cursor-pointer hover:border-primary transition-colors" onClick={() => startQuiz(opt.preset, opt.clef)}>
                <button className="w-full text-left px-4 py-3" type="button">
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-sm text-muted">{opt.description}</div>
                </button>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm">Back to Home</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
