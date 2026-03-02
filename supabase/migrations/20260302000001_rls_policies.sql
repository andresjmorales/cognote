-- Enable RLS on all tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;

-- Teachers: can only read/write their own row
CREATE POLICY teachers_own ON teachers
  FOR ALL USING (id = auth.uid());

-- Students: teacher can CRUD their own students
CREATE POLICY students_teacher ON students
  FOR ALL USING (teacher_id = auth.uid());

-- Plans: teacher can CRUD their own plans
CREATE POLICY plans_teacher ON plans
  FOR ALL USING (teacher_id = auth.uid());

-- Student plans: teacher can manage through ownership chain
CREATE POLICY student_plans_teacher ON student_plans
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid())
  );

-- Student plans: anonymous can SELECT by token (for practice pages)
CREATE POLICY student_plans_token_read ON student_plans
  FOR SELECT USING (true);

-- Practice sessions: teacher can view through ownership chain
CREATE POLICY sessions_teacher ON practice_sessions
  FOR SELECT USING (
    student_plan_id IN (
      SELECT sp.id FROM student_plans sp
      JOIN students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

-- Practice sessions: anonymous can insert/update (student practice)
CREATE POLICY sessions_anon_insert ON practice_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY sessions_anon_update ON practice_sessions
  FOR UPDATE USING (true);

-- Note attempts: teacher can view through chain
CREATE POLICY attempts_teacher ON note_attempts
  FOR SELECT USING (
    session_id IN (
      SELECT ps.id FROM practice_sessions ps
      JOIN student_plans sp ON sp.id = ps.student_plan_id
      JOIN students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

-- Note attempts: anonymous can insert (student answering)
CREATE POLICY attempts_anon_insert ON note_attempts
  FOR INSERT WITH CHECK (true);

-- Flashcard progress: teacher can view
CREATE POLICY flashcard_teacher ON flashcard_progress
  FOR SELECT USING (
    student_plan_id IN (
      SELECT sp.id FROM student_plans sp
      JOIN students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

-- Flashcard progress: anonymous can read/write (student practice)
CREATE POLICY flashcard_anon ON flashcard_progress
  FOR ALL USING (true);
