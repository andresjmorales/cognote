import { describe, it, expect } from "vitest";
import {
  nextReviewState,
  defaultFlashcardState,
  type FlashcardState,
} from "@/lib/srs";

describe("SM-2 nextReviewState", () => {
  it("starts new cards at ease 2.5, interval 0", () => {
    expect(defaultFlashcardState()).toEqual({
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
    });
  });

  it("graduates: Good → 1 day, then 3 days, then interval × ease", () => {
    let state = defaultFlashcardState();

    state = nextReviewState(state, 4);
    expect(state.intervalDays).toBe(1);
    expect(state.repetitions).toBe(1);
    // Good (4): ease delta is 0.1 - 1*(0.08 + 0.02) = 0 — ease unchanged
    expect(state.easeFactor).toBeCloseTo(2.5);

    state = nextReviewState(state, 4);
    expect(state.intervalDays).toBe(3);
    expect(state.repetitions).toBe(2);

    state = nextReviewState(state, 4);
    expect(state.intervalDays).toBe(Math.round(3 * 2.5)); // 8
    expect(state.repetitions).toBe(3);
  });

  it("Easy grows ease and the interval faster than Good", () => {
    const reviewed: FlashcardState = { easeFactor: 2.5, intervalDays: 3, repetitions: 2 };
    const easy = nextReviewState(reviewed, 5);
    expect(easy.easeFactor).toBeCloseTo(2.6); // +0.1
    expect(easy.intervalDays).toBe(8);

    const easyAgain = nextReviewState(easy, 5);
    expect(easyAgain.intervalDays).toBe(Math.round(8 * 2.6)); // 21
  });

  it("Again resets the card and penalizes ease", () => {
    const mature: FlashcardState = { easeFactor: 2.5, intervalDays: 20, repetitions: 5 };
    const state = nextReviewState(mature, 1);
    expect(state.intervalDays).toBe(1);
    expect(state.repetitions).toBe(0);
    // Again (1): ease delta is 0.1 - 4*(0.08 + 4*0.02) = -0.54
    expect(state.easeFactor).toBeCloseTo(1.96);
  });

  it("Hard resets the card with a smaller ease penalty", () => {
    const mature: FlashcardState = { easeFactor: 2.5, intervalDays: 20, repetitions: 5 };
    const state = nextReviewState(mature, 2);
    expect(state.intervalDays).toBe(1);
    expect(state.repetitions).toBe(0);
    // Hard (2): ease delta is 0.1 - 3*(0.08 + 3*0.02) = -0.32
    expect(state.easeFactor).toBeCloseTo(2.18);
  });

  it("ease never drops below the 1.3 floor", () => {
    let state = defaultFlashcardState();
    for (let i = 0; i < 20; i++) {
      state = nextReviewState(state, 1);
    }
    expect(state.easeFactor).toBe(1.3);
  });

  it("a lapsed card regrows intervals from scratch", () => {
    let state: FlashcardState = { easeFactor: 2.5, intervalDays: 20, repetitions: 5 };
    state = nextReviewState(state, 1); // lapse
    state = nextReviewState(state, 4);
    expect(state.intervalDays).toBe(1);
    state = nextReviewState(state, 4);
    expect(state.intervalDays).toBe(3);
  });
});
