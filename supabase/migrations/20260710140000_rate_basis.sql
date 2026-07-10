-- Rate basis: per_lesson (flat) vs per_hour (scales with duration_minutes).
ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS rate_basis text NOT NULL DEFAULT 'per_lesson'
    CHECK (rate_basis IN ('per_lesson', 'per_hour'));

COMMENT ON COLUMN studio_policies.rate_basis IS
  'per_lesson = configured rate is the full lesson charge; per_hour = rate × (minutes/60).';
