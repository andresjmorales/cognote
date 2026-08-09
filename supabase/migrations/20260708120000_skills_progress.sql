-- Skills + progress.
--
-- Design notes:
-- * skill_dimensions are per-teacher and extensible; defaults (Musicianship,
--   Rhythm, Sight Reading, Technique, Musicality, Theory) are seeded lazily
--   by the API the first time a teacher touches skills, so future sign-ups
--   get them too — a migration-time seed would only cover existing teachers.
-- * skill_assessments are timestamped 1–5 ratings, appended (never updated)
--   at whatever cadence the teacher wants — the history IS the trend line.
-- * students.level is the optional human-set anchor (RCM level, Faber book);
--   free text because leveling systems vary (§4).

ALTER TABLE students
  ADD COLUMN level text;

COMMENT ON COLUMN students.level IS
  'Optional human-set level anchor, e.g. "RCM Level 3" or "Faber 2B" (§4).';

CREATE TABLE skill_dimensions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);
CREATE INDEX idx_skill_dimensions_teacher ON skill_dimensions(teacher_id);

CREATE TABLE skill_assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES skill_dimensions(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rating       int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note         text,
  -- Local date in the studio timezone; the API passes it explicitly
  -- (CURRENT_DATE here would be the UTC date — already "tomorrow" during
  -- US evenings, same pitfall as lesson materialization).
  assessed_on  date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_skill_assessments_student ON skill_assessments(student_id, assessed_on);
CREATE INDEX idx_skill_assessments_dimension ON skill_assessments(dimension_id);

-- RLS: teacher ownership everywhere (portal never reads these — skills are
-- teacher-facing until report cards ship).
ALTER TABLE skill_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_dimensions_teacher ON skill_dimensions
  FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_assessments_teacher ON skill_assessments
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  skill_dimensions,
  skill_assessments
TO anon, authenticated, service_role;
