-- Add teacher notes and difficulty to plans
ALTER TABLE plans ADD COLUMN teacher_notes text NOT NULL DEFAULT '';
ALTER TABLE plans ADD COLUMN difficulty text NOT NULL DEFAULT 'beginner'
  CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));

-- Add plan type: note identification vs symbol/concept quiz
ALTER TABLE plans ADD COLUMN plan_type text NOT NULL DEFAULT 'note_identification'
  CHECK (plan_type IN ('note_identification', 'symbol_concepts'));

-- Symbols/concepts to quiz (for symbol_concepts plans)
-- Each entry: { "id": "forte", "symbol": "f", "term": "Forte", "definition": "Play loudly" }
ALTER TABLE plans ADD COLUMN symbols jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Constrain answer choices to even numbers
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_answer_choices_check;
ALTER TABLE plans ADD CONSTRAINT plans_answer_choices_check
  CHECK (answer_choices IN (2, 4, 6));

-- Add teacher notes to students
ALTER TABLE students ADD COLUMN teacher_notes text NOT NULL DEFAULT '';
