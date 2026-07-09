-- Repair: re-activate assignments that were soft-unarchived after the unassign
-- feature deploy. Safe to run multiple times (no-op when nothing is archived).
UPDATE student_plans
SET unassigned_at = NULL
WHERE unassigned_at IS NOT NULL;
