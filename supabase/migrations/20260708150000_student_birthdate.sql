-- Optional student birthday — shown with a computed age on the student page.
-- Table-level grants and RLS already cover students; no new policies needed.
ALTER TABLE students
  ADD COLUMN birthdate date;

COMMENT ON COLUMN students.birthdate IS
  'Optional; used to show the student''s age alongside their level anchor.';
