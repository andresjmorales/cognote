-- Enums
CREATE TYPE clef_type AS ENUM ('treble', 'bass', 'both');
CREATE TYPE practice_mode AS ENUM ('lesson', 'free_practice', 'flashcard');

-- Teachers (mirrors Supabase auth.users)
CREATE TABLE teachers (
  id          uuid PRIMARY KEY,  -- same as auth.users.id
  email       text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Students
CREATE TABLE students (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name           text NOT NULL,
  parent_contact text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_teacher ON students(teacher_id);

-- Plans
CREATE TABLE plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id           uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  is_template          boolean NOT NULL DEFAULT false,
  clef                 clef_type NOT NULL DEFAULT 'treble',
  key_signature        text NOT NULL DEFAULT 'C major',
  include_sharps       boolean NOT NULL DEFAULT false,
  include_flats        boolean NOT NULL DEFAULT false,
  include_chords       boolean NOT NULL DEFAULT false,
  measures_shown       int NOT NULL DEFAULT 1 CHECK (measures_shown IN (1, 2)),
  questions_per_lesson int NOT NULL DEFAULT 10 CHECK (questions_per_lesson BETWEEN 5 AND 30),
  answer_choices       int NOT NULL DEFAULT 4 CHECK (answer_choices BETWEEN 2 AND 7),
  notes                jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_teacher ON plans(teacher_id);

-- Student ↔ Plan assignments
CREATE TABLE student_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date    date
);
CREATE INDEX idx_student_plans_token ON student_plans(token);
CREATE INDEX idx_student_plans_student ON student_plans(student_id);

-- Practice sessions
CREATE TABLE practice_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_plan_id uuid NOT NULL REFERENCES student_plans(id) ON DELETE CASCADE,
  mode            practice_mode NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  total_correct   int NOT NULL DEFAULT 0,
  total_incorrect int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_student_plan ON practice_sessions(student_plan_id);

-- Individual note attempts within a session
CREATE TABLE note_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  note_displayed   text NOT NULL,
  clef             text NOT NULL CHECK (clef IN ('treble', 'bass')),
  correct_answer   text NOT NULL,
  student_answer   text NOT NULL,
  is_correct       boolean NOT NULL,
  response_time_ms int,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_session ON note_attempts(session_id);

-- Flashcard spaced-repetition state
CREATE TABLE flashcard_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_plan_id uuid NOT NULL REFERENCES student_plans(id) ON DELETE CASCADE,
  note            text NOT NULL,
  clef            text NOT NULL CHECK (clef IN ('treble', 'bass')),
  ease_factor     float NOT NULL DEFAULT 2.5,
  interval_days   int NOT NULL DEFAULT 0,
  repetitions     int NOT NULL DEFAULT 0,
  next_review     timestamptz NOT NULL DEFAULT now(),
  last_reviewed   timestamptz,
  UNIQUE (student_plan_id, note, clef)
);
CREATE INDEX idx_flashcard_student_plan ON flashcard_progress(student_plan_id);

-- Auto-update updated_at on plans
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
