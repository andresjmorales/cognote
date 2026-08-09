-- Scheduling + attendance.
--
-- Design notes:
-- * Slots store LOCAL day/time; the studio's IANA timezone lives on
--   studio_policies. Each occurrence is materialized to a concrete UTC
--   instant individually, so a 4:00 PM Tuesday lesson stays 4:00 PM local
--   across DST shifts.
-- * Studio policies are per-teacher settings, never hardcoded rules.
--   v1 covers timezone + cancellation window + make-up credit rules;
--   the billing half comes in a later migration.
-- * Make-ups link to their originating cancellation via lessons.makeup_for →
--   attendance.id, so credit banking/expiry/billability are derivable and
--   the original + make-up can never both bill (§3).

-- Per-teacher studio policy settings (§3: settings, not code)
CREATE TABLE studio_policies (
  teacher_id                  uuid PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  timezone                    text NOT NULL DEFAULT 'America/Chicago',
  cancellation_window_hours   int  NOT NULL DEFAULT 24 CHECK (cancellation_window_hours >= 0),
  -- Which events earn a make-up credit:
  timely_cancel_earns_makeup  boolean NOT NULL DEFAULT true,   -- student cancel with notice outside the window
  late_cancel_earns_makeup    boolean NOT NULL DEFAULT false,  -- student cancel inside the window
  no_show_earns_makeup        boolean NOT NULL DEFAULT false,
  teacher_cancel_earns_makeup boolean NOT NULL DEFAULT true,
  makeup_credit_expiry_days   int CHECK (makeup_credit_expiry_days > 0),  -- NULL = never expires
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER studio_policies_updated_at
  BEFORE UPDATE ON studio_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recurring weekly lesson slots (local time; timezone comes from studio_policies)
CREATE TABLE lesson_slots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day_of_week      int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0 = Sunday
  start_time       time NOT NULL,
  duration_minutes int  NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  start_date       date NOT NULL DEFAULT CURRENT_DATE,
  end_date         date,          -- NULL = open-ended
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_slots_teacher ON lesson_slots(teacher_id);
CREATE INDEX idx_lesson_slots_student ON lesson_slots(student_id);

-- Materialized lesson occurrences (from slots, or ad-hoc/make-up when slot_id IS NULL)
CREATE TABLE lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  slot_id          uuid REFERENCES lesson_slots(id) ON DELETE SET NULL,
  lesson_date      date NOT NULL,               -- local date in studio timezone
  starts_at        timestamptz NOT NULL,        -- concrete instant, DST-correct per occurrence
  duration_minutes int  NOT NULL CHECK (duration_minutes > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, lesson_date)                 -- idempotent materialization
);
CREATE INDEX idx_lessons_teacher_date ON lessons(teacher_id, lesson_date);
CREATE INDEX idx_lessons_student ON lessons(student_id);

-- Attendance: facts about what happened, one row per lesson once marked.
-- Lateness of a cancellation is derived from notice_at vs starts_at vs the
-- policy window — the policy is applied at read time, never baked in (§3).
CREATE TABLE attendance (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  status    text NOT NULL CHECK (status IN ('attended', 'teacher_cancel', 'student_cancel', 'no_show')),
  notice_at timestamptz,   -- when cancellation notice was given (student_cancel)
  marked_at timestamptz NOT NULL DEFAULT now()
);

-- Make-up link: a make-up lesson references the attendance row of the
-- cancellation that earned it (§3: no double-billing, credits derivable).
ALTER TABLE lessons
  ADD COLUMN makeup_for uuid UNIQUE REFERENCES attendance(id) ON DELETE SET NULL;

-- Per-lesson notes; optionally shared with (and emailed to) the guardian
CREATE TABLE lesson_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          uuid NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  body               text NOT NULL,
  shared_with_parent boolean NOT NULL DEFAULT false,
  emailed_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lesson_notes_updated_at
  BEFORE UPDATE ON lesson_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: teacher ownership everywhere. Portal reads go through the
-- service-role client with token lookup in application code.
ALTER TABLE studio_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_policies_teacher ON studio_policies
  FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE lesson_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_slots_teacher ON lesson_slots
  FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lessons_teacher ON lessons
  FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_teacher ON attendance
  FOR ALL USING (
    lesson_id IN (SELECT id FROM lessons WHERE teacher_id = auth.uid())
  );

ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_notes_teacher ON lesson_notes
  FOR ALL USING (
    lesson_id IN (SELECT id FROM lessons WHERE teacher_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  studio_policies,
  lesson_slots,
  lessons,
  attendance,
  lesson_notes
TO anon, authenticated, service_role;
