# Spaced Repetition in CogNote

## What is Spaced Repetition?

Spaced repetition is a study technique where you review material at increasing intervals. Items you know well are shown less often; items you struggle with are shown more frequently. This is proven to be one of the most effective ways to move information into long-term memory.

CogNote's flashcard mode uses the **SM-2 algorithm**, the same algorithm that powers Anki (the most popular flashcard app). It was originally developed by Piotr Wozniak in 1987.

## How It Works

When a student reviews a flashcard, they see a note on the staff, flip the card to see the answer, then **self-assess** how well they knew it. Based on their rating, the algorithm decides when to show that card again.

### The Four Ratings

Each rating maps to an internal numeric value used by the SM-2 algorithm:

| Rating | SM-2 Value | Student UI | What it means | Effect on scheduling |
|--------|-----------|------------|---------------|---------------------|
| **Again** | 1 | 😕 No clue | Didn't recognize the note at all | Resets the card — shows again very soon (next session) |
| **Hard** | 2 | 🤔 Tricky | Got it eventually, but struggled | Resets the card — shows again soon, but ease factor drops less than "Again" |
| **Good** | 4 | 👍 Got it! | Knew the answer correctly | Normal progression — interval grows by the ease factor |
| **Easy** | 5 | ⭐ Too easy! | Knew it instantly, no hesitation | Accelerated progression — interval grows faster, ease factor increases |

### Why Not 3?

The SM-2 scale skips rating 3. Ratings 1-2 mean "failed" (card resets), ratings 4-5 mean "passed" (card advances). This binary pass/fail with a gradient within each group is what makes SM-2 effective.

## The Algorithm

Three values are tracked per card:

- **Ease Factor** — A multiplier (starts at 2.5) that controls how fast intervals grow. Higher = the student finds this card easier, so we show it less often. Minimum is 1.3.
- **Interval** — Days until the next review. Starts at 0 (new card), then 1, then 3, then grows by the ease factor.
- **Repetitions** — How many times in a row the student has "passed" (rated ≥ 4) this card.

### After Each Review

```
If rating ≥ 3 (Good or Easy):
    If first successful review:     interval = 1 day
    If second successful review:    interval = 3 days
    Otherwise:                      interval = previous interval × ease factor
    repetitions += 1

If rating < 3 (Again or Hard):
    repetitions = 0  (reset the streak)
    interval = 1 day (show again tomorrow)

Ease factor adjustment (always applied):
    ease_factor += 0.1 - (5 - rating) × (0.08 + (5 - rating) × 0.02)
    ease_factor = max(1.3, ease_factor)  (floor)
```

### Ease Factor Changes by Rating

| Rating | Ease factor change | Example (starting at 2.5) |
|--------|--------------------|---------------------------|
| Again (1) | −0.80 | 2.5 → 1.70 |
| Hard (2) | −0.54 | 2.5 → 1.96 |
| Good (4) | +0.00 | 2.5 → 2.50 (unchanged) |
| Easy (5) | +0.10 | 2.5 → 2.60 |

Cards the student consistently struggles with converge toward a 1.3x ease factor (frequent reviews). Cards they consistently ace grow toward longer and longer intervals.

## Kid-Friendly Adaptation

The standard Anki labels "Again / Hard / Good / Easy" assume the user understands spaced repetition. CogNote replaces these with emoji-based labels that a child can understand intuitively:

- 😕 **No clue** — "I had no idea what that note was"
- 🤔 **Tricky** — "I figured it out, but it was hard"
- 👍 **Got it!** — "I knew that one"
- ⭐ **Too easy!** — "That was so easy, don't show it as much"

The underlying SM-2 math is identical — only the presentation changes.

## Session Flow

1. Cards **due for review** (next_review ≤ now) are shown first
2. Then **new cards** that haven't been reviewed yet
3. After rating each card, the next review date is calculated and saved
4. Students can quit at any time — progress is saved per-card

## References

- [SM-2 Algorithm (SuperMemo)](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Anki Manual — Studying](https://docs.ankiweb.net/studying.html)
