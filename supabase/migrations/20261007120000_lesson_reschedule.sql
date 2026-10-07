-- Lesson reschedules (issue #121).
--
-- A moved lesson keeps its slot_id (so billing still resolves the slot rate)
-- but its lesson_date/starts_at are changed in place. rescheduled_from_date
-- records the ORIGINAL slot occurrence the lesson was moved away from, so
-- materializeLessons can skip refilling it (the UNIQUE (slot_id, lesson_date)
-- key would otherwise re-create the lesson at its old date on the next load).
--
-- No new GRANT: public.lessons already carries a table-level
-- SELECT/INSERT/UPDATE/DELETE grant (20260707010000_scheduling.sql) and RLS
-- lessons_teacher scopes every row; new columns inherit it.

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS rescheduled_from_date date;

COMMENT ON COLUMN public.lessons.rescheduled_from_date IS
  'Original slot occurrence date this lesson was moved away from; NULL when never '
  'moved. materializeLessons skips the (slot_id, rescheduled_from_date) pair so the '
  'vacated occurrence is not re-created.';

-- Materialization reads this per teacher; a partial index keeps that lookup cheap.
CREATE INDEX IF NOT EXISTS idx_lessons_rescheduled
  ON public.lessons (teacher_id) WHERE rescheduled_from_date IS NOT NULL;
