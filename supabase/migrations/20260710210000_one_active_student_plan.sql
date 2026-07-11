-- A student can have historical assignments for the same lesson, but only one
-- active assignment. Older duplicate rows remain as archived history.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY student_id, plan_id
      ORDER BY assigned_at DESC, id DESC
    ) AS position
  FROM student_plans
  WHERE unassigned_at IS NULL
)
UPDATE student_plans AS sp
SET unassigned_at = now()
FROM ranked
WHERE sp.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS student_plans_one_active_assignment
  ON student_plans (student_id, plan_id)
  WHERE unassigned_at IS NULL;
