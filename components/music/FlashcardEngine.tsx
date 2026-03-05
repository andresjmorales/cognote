"use client";

import { useCallback, useState } from "react";
import { StaffRenderer } from "./StaffRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type FlashcardState,
  type SRSRating,
  SRS_KID_LABELS,
  nextReviewState,
} from "@/lib/srs";
import { noteName, displayNoteName, displayKeySignatureName, shuffle, KEY_SIGNATURES } from "@/lib/music";
import { SymbolDisplay } from "./VexFlowSymbol";

interface NoteCard {
  itemType: "note";
  note: string;
  clef: "treble" | "bass";
  state: FlashcardState;
}

interface SymbolCard {
  itemType: "symbol";
  symbolId: string;
  symbol: string;
  term: string;
  definition: string;
  state: FlashcardState;
}

interface KeySignatureCard {
  itemType: "key_signature";
  keyName: string;
  clef: "treble" | "bass";
  state: FlashcardState;
}

export type FlashcardItem = NoteCard | SymbolCard | KeySignatureCard;

export interface FlashcardReviewData {
  itemType: "note" | "symbol" | "key_signature";
  itemId: string;
  clef: "treble" | "bass" | "none";
  rating: SRSRating;
  newState: FlashcardState;
}

interface FlashcardEngineProps {
  cards: FlashcardItem[];
  keySignature?: string;
  onReview?: (data: FlashcardReviewData) => void;
  onQuit?: () => void;
}

/**
 * Anki-style session logic:
 * - "Got it!" or "Too easy!" (rating >= 3) → card graduates, removed from the pile
 * - "No clue" or "Tricky" (rating < 3)    → card goes back into the remaining pile
 * - Session ends when all cards have graduated
 */
export function FlashcardEngine({
  cards: initialCards,
  keySignature = "C major",
  onReview,
  onQuit,
}: FlashcardEngineProps) {
  const [queue, setQueue] = useState<FlashcardItem[]>(() => shuffle(initialCards));
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [graduated, setGraduated] = useState(0);
  const total = initialCards.length;

  const vexKeySig = KEY_SIGNATURES[keySignature] ?? "C";
  const current = queue[0] ?? null;

  const handleRating = useCallback(
    (rating: SRSRating) => {
      if (!current) return;

      const newState = nextReviewState(current.state, rating);
      onReview?.({
        itemType: current.itemType,
        itemId:
          current.itemType === "note" ? current.note :
          current.itemType === "key_signature" ? current.keyName :
          current.symbolId,
        clef: current.itemType === "note" || current.itemType === "key_signature" ? current.clef : "none",
        rating,
        newState,
      });
      setReviewed((r) => r + 1);
      setFlipped(false);

      setQueue((prev) => {
        const rest = prev.slice(1);

        if (rating >= 3) {
          // Card graduates — don't put it back
          setGraduated((g) => g + 1);
          return rest;
        }

        // Card failed — reinsert at a random position in the back half
        // so the student doesn't see it again immediately
        const updated = { ...current, state: newState };
        const minPos = Math.max(1, Math.floor(rest.length / 2));
        const insertAt =
          rest.length <= 1
            ? rest.length
            : minPos + Math.floor(Math.random() * (rest.length - minPos + 1));
        const newQueue = [...rest];
        newQueue.splice(insertAt, 0, updated);
        return newQueue;
      });
    },
    [current, onReview]
  );

  if (!current || queue.length === 0) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center font-[family-name:var(--font-nunito)]">
        <div className="text-5xl mb-4">🎶</div>
        <h2 className="text-2xl font-bold mb-2">All done!</h2>
        <p className="text-muted mb-2">
          {graduated} card{graduated !== 1 && "s"} reviewed in {reviewed} flip{reviewed !== 1 && "s"}.
        </p>
        {reviewed > graduated && (
          <p className="text-sm text-muted mb-4">
            You repeated {reviewed - graduated} card{reviewed - graduated !== 1 && "s"} until you got them.
          </p>
        )}
        {onQuit && (
          <Button onClick={onQuit} variant="secondary">
            Go Back
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="max-w-lg w-full mx-auto font-[family-name:var(--font-nunito)] flex flex-col">
      <div className="flex justify-between items-center text-sm text-muted mb-4">
        <span>Reviewed: {reviewed}</span>
        <span>
          {graduated}/{total} done
        </span>
      </div>

      <div className="h-2 bg-surface-dim rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${total > 0 ? (graduated / total) * 100 : 0}%` }}
        />
      </div>

      <Card
        className="mb-6 cursor-pointer select-none"
        style={{ minHeight: 280 }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: 248 }}>
          {current.itemType === "note" ? (
            <>
              <StaffRenderer
                note={current.note}
                clef={current.clef}
                keySignature={vexKeySig}
              />
              {flipped && (
                <div className="mt-4 text-center">
                  <div className="text-4xl font-bold text-primary">
                    {displayNoteName(noteName(current.note))}
                  </div>
                  <div className="text-sm text-muted mt-1">
                    {displayNoteName(current.note)} — {current.clef} clef
                  </div>
                </div>
              )}
            </>
          ) : current.itemType === "key_signature" ? (
            <>
              <StaffRenderer
                clef={current.clef}
                keySignature={KEY_SIGNATURES[current.keyName] ?? "C"}
              />
              {flipped && (
                <div className="mt-4 text-center">
                  <div className="text-4xl font-bold text-primary">
                    {displayKeySignatureName(current.keyName)}
                  </div>
                  <div className="text-sm text-muted mt-1">
                    {current.clef} clef
                  </div>
                </div>
              )}
            </>
          ) : current.symbol.toLowerCase().trim() === current.term.toLowerCase().trim() ? (
            <>
              <div className="py-6 text-center">
                <div className="text-3xl font-bold">{current.term}</div>
              </div>
              {flipped && (
                <div className="text-center pb-2">
                  <div className="text-base text-muted">{current.definition}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="py-4 flex flex-col items-center justify-center">
                <SymbolDisplay symbolId={current.symbolId} symbolText={current.symbol} />
              </div>
              {flipped && (
                <div className="text-center pb-2">
                  <div className="text-3xl font-bold text-primary">{current.term}</div>
                  <div className="text-base text-muted mt-1">{current.definition}</div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-2" style={{ minHeight: 72 }}>
        {flipped ? (
          ([1, 2, 4, 5] as SRSRating[]).map((rating) => {
            const { emoji, text } = SRS_KID_LABELS[rating];
            const variant =
              rating === 5 ? "success" :
              rating === 4 ? "successLight" :
              rating === 2 ? "warning" :
              "error";
            return (
              <Button
                key={rating}
                variant={variant}
                size="lg"
                onClick={() => handleRating(rating)}
                className="flex flex-col gap-0.5 !py-3"
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs">{text}</span>
              </Button>
            );
          })
        ) : (
          <div className="col-span-4 flex justify-center">
            <Button size="lg" onClick={() => setFlipped(true)} className="w-full">
              Show Answer
            </Button>
          </div>
        )}
      </div>

      {onQuit && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={onQuit}>
            I&apos;m Done
          </Button>
        </div>
      )}
    </div>
  );
}
