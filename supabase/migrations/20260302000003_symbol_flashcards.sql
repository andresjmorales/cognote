-- Support flashcards for symbol/concept plans.
-- Adds item_type to distinguish note vs symbol flashcard progress.
-- Relaxes clef constraint to allow 'none' for symbol items.

ALTER TABLE flashcard_progress
  ADD COLUMN item_type text NOT NULL DEFAULT 'note';

ALTER TABLE flashcard_progress
  DROP CONSTRAINT flashcard_progress_clef_check;

ALTER TABLE flashcard_progress
  ADD CONSTRAINT flashcard_progress_clef_check
  CHECK (clef IN ('treble', 'bass', 'none'));

ALTER TABLE flashcard_progress
  DROP CONSTRAINT flashcard_progress_student_plan_id_note_clef_key;

ALTER TABLE flashcard_progress
  ADD CONSTRAINT flashcard_progress_unique_item
  UNIQUE (student_plan_id, item_type, note, clef);
