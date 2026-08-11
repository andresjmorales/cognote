-- Duration-based flat rates (studio) and home-visit travel fees.
--
-- duration_rate_cents: optional map of lesson minutes → flat charge in cents
--   e.g. {"20": 3000, "30": 4000, "45": 6000}. Used when no slot rate is set.
-- travel_fee_cents: studio default flat fee for home visits.
-- students.travel_fee_cents: per-student override (same cascade as rates).
-- is_home_visit on slots/lessons marks visits that incur the travel fee.

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS duration_rate_cents jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS travel_fee_cents int
    CHECK (travel_fee_cents IS NULL OR travel_fee_cents >= 0);

COMMENT ON COLUMN studio_policies.duration_rate_cents IS
  'Optional map of duration minutes (as text keys) to flat lesson charge in cents.';
COMMENT ON COLUMN studio_policies.travel_fee_cents IS
  'Studio-wide flat travel fee in cents for home visits; overridden by student.travel_fee_cents.';

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS travel_fee_cents int
    CHECK (travel_fee_cents IS NULL OR travel_fee_cents >= 0);

COMMENT ON COLUMN students.travel_fee_cents IS
  'Per-student travel fee override in cents; falls back to studio travel_fee_cents.';

ALTER TABLE lesson_slots
  ADD COLUMN IF NOT EXISTS is_home_visit boolean NOT NULL DEFAULT false;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_home_visit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lesson_slots.is_home_visit IS
  'When true, materialized lessons inherit home-visit status for travel fees.';
COMMENT ON COLUMN lessons.is_home_visit IS
  'Home visit flag for travel fee billing (copied from slot or set on one-offs).';
