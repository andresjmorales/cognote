"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy } from "@/lib/schedule";

export function StreakSettingsForm({ policy }: { policy: StudioPolicy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(policy.streaks_enabled);
  const [countQuiz, setCountQuiz] = useState(policy.streak_count_quiz);
  const [countFreePractice, setCountFreePractice] = useState(
    policy.streak_count_free_practice
  );
  const [countFlashcards, setCountFlashcards] = useState(
    policy.streak_count_flashcards
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streaksEnabled: enabled,
        streakCountQuiz: countQuiz,
        streakCountFreePractice: countFreePractice,
        streakCountFlashcards: countFlashcards,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-1">Practice streaks</h2>
      <p className="text-sm text-muted mb-3">
        Optionally track consecutive practice days and simple milestones for
        students. Off by default.
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Practice streaks</span>
            <span className="block text-xs text-muted">
              Show streak and badge info when students practice.
            </span>
          </span>
        </label>

        {enabled && (
          <fieldset className="space-y-2 pl-6">
            <legend className="text-xs font-semibold text-muted mb-1">
              What counts as a practice day
            </legend>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={countQuiz}
                onChange={(e) => setCountQuiz(e.target.checked)}
              />
              Completed quizzes
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={countFreePractice}
                onChange={(e) => setCountFreePractice(e.target.checked)}
              />
              Free practice sessions
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={countFlashcards}
                onChange={(e) => setCountFlashcards(e.target.checked)}
              />
              Flashcard reviews
            </label>
          </fieldset>
        )}

        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save streak settings"}
        </Button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </form>
    </Card>
  );
}
