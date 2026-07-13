-- Phase 7: studio events (recitals) + RSVPs; opt-in practice streak settings

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_teacher_starts ON events (teacher_id, starts_at);

CREATE TABLE event_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  repertoire text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (event_id, student_id)
);

CREATE INDEX idx_event_students_student ON event_students (student_id);

CREATE TYPE rsvp_status AS ENUM ('pending', 'yes', 'no', 'maybe');

CREATE TABLE event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  status rsvp_status NOT NULL DEFAULT 'pending',
  party_size int,
  note text NOT NULL DEFAULT '',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, guardian_id)
);

CREATE INDEX idx_event_rsvps_guardian ON event_rsvps (guardian_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_teacher ON events
  FOR ALL USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY event_students_teacher ON event_students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_students.event_id AND e.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_students.event_id AND e.teacher_id = auth.uid()
    )
  );

CREATE POLICY event_rsvps_teacher ON event_rsvps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id AND e.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id AND e.teacher_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE events TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_students TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE event_rsvps TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Streak settings (opt-in; off by default)
-- ---------------------------------------------------------------------------

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS streaks_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_count_quiz boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS streak_count_free_practice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_count_flashcards boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN studio_policies.streaks_enabled IS
  'When false, streak/badge UI is hidden everywhere.';
COMMENT ON COLUMN studio_policies.streak_count_quiz IS
  'Completed quiz (lesson mode) sessions count as a practice day.';
COMMENT ON COLUMN studio_policies.streak_count_free_practice IS
  'Completed free_practice sessions count as a practice day.';
COMMENT ON COLUMN studio_policies.streak_count_flashcards IS
  'Flashcard activity on a local day counts as a practice day.';
