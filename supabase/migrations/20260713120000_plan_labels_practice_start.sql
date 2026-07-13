-- Phase 7 polish: plan labels, student practice_start_date

-- Plans: replace unused-feeling difficulty enum with freeform labels
ALTER TABLE plans ADD COLUMN labels text[] NOT NULL DEFAULT '{}';

UPDATE plans SET labels = CASE difficulty
  WHEN 'beginner' THEN ARRAY['Easy']
  WHEN 'intermediate' THEN ARRAY['Intermediate']
  WHEN 'advanced' THEN ARRAY['Advanced']
  ELSE '{}'::text[]
END;

ALTER TABLE plans DROP COLUMN difficulty;

CREATE INDEX idx_plans_labels ON plans USING GIN (labels);

-- Students: optional "practicing since" date (year-only stored as YYYY-01-01)
ALTER TABLE students ADD COLUMN practice_start_date date;

COMMENT ON COLUMN students.practice_start_date IS
  'Optional start of practice with this studio. Year-only is stored as YYYY-01-01.';
