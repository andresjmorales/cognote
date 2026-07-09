-- Soft-unassign practice lessons: keep rows (and all practice history) when a
-- student has started, hide from active lists via unassigned_at.

ALTER TABLE student_plans
  ADD COLUMN unassigned_at timestamptz;

COMMENT ON COLUMN student_plans.unassigned_at IS
  'When set, the assignment is inactive — hidden from portal and active lists, but practice sessions remain.';
