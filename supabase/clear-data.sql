-- Clear all students and plans (and cascaded data: student_plans, practice_sessions, note_attempts, flashcard_progress).
-- Safe to run in production: teachers and auth.users are NOT touched.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) or via: psql $DATABASE_URL -f supabase/clear-data.sql
--
-- After running:
--   • Production: You're done. Teachers stay; students and lessons are wiped so you can start fresh.
--   • Local dev: To get sample data again, run seed.sql (creates test teacher + sample students/plans).

DELETE FROM plans;
DELETE FROM students;
