-- Timed quizzes (issue #25): optional per-question time limit on plans.
-- 0 = untimed. Applies to quiz (lesson) mode only; free practice stays pressure-free.
ALTER TABLE plans ADD COLUMN time_limit_seconds int NOT NULL DEFAULT 0
  CHECK (time_limit_seconds BETWEEN 0 AND 60);
