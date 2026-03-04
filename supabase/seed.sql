-- Seed data for LOCAL DEVELOPMENT ONLY.
-- Do NOT run this in production — it creates a test account with a known password.
-- Creates a test auth user + matching teacher, students, plans, and sample sessions.

-- Create a test auth user directly (password: "password123")
-- The UUID is deterministic so the teachers row can reference it.
-- All varchar/text columns must be '' not NULL — GoTrue scans them as non-nullable strings.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone, phone_change, phone_change_token,
  reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'teacher@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Ms. Johnson"}',
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', '', '', '', '', '', '', '', ''
);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"teacher@example.com"}',
  'email',
  now(),
  now(),
  now()
);

-- Teacher row matching the auth user above
INSERT INTO teachers (id, email, display_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'teacher@example.com', 'Ms. Johnson');

-- Sample students
INSERT INTO students (id, teacher_id, name, parent_contact) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Emma', 'emma.parent@example.com'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Liam', 'liam.parent@example.com'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sophia', NULL);

-- Sample plans
INSERT INTO plans (id, teacher_id, name, is_template, clef, key_signature, questions_per_lesson, answer_choices, notes) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Week 1 — Middle C Position', true, 'treble', 'C major', 10, 4,
   '["C4","D4","E4","F4","G4"]'::jsonb),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Week 2 — Treble Staff Lines', true, 'treble', 'C major', 10, 4,
   '["E4","G4","B4","D5","F5"]'::jsonb),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Bass Clef Intro', true, 'bass', 'C major', 8, 4,
   '["G2","A2","B2","C3","D3","E3","F3","G3"]'::jsonb);

-- Assign plans to students
INSERT INTO student_plans (id, student_id, plan_id, token) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'dev-token-emma-week1'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', 'dev-token-liam-week1'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000002', 'dev-token-sophia-week2');

-- Sample practice sessions for Emma
INSERT INTO practice_sessions (id, student_plan_id, mode, started_at, completed_at, total_correct, total_incorrect, total_questions) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'lesson', now() - interval '2 days', now() - interval '2 days' + interval '5 minutes', 8, 2, 10),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'lesson', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes', 9, 1, 10);

-- Sample note attempts for Emma's first session
INSERT INTO note_attempts (session_id, note_displayed, clef, correct_answer, student_answer, is_correct, response_time_ms) VALUES
  ('40000000-0000-0000-0000-000000000001', 'C4', 'treble', 'C', 'C', true, 2100),
  ('40000000-0000-0000-0000-000000000001', 'E4', 'treble', 'E', 'E', true, 1800),
  ('40000000-0000-0000-0000-000000000001', 'G4', 'treble', 'G', 'F', false, 3200),
  ('40000000-0000-0000-0000-000000000001', 'D4', 'treble', 'D', 'D', true, 1500),
  ('40000000-0000-0000-0000-000000000001', 'F4', 'treble', 'F', 'F', true, 2000),
  ('40000000-0000-0000-0000-000000000001', 'C4', 'treble', 'C', 'C', true, 1200),
  ('40000000-0000-0000-0000-000000000001', 'E4', 'treble', 'E', 'D', false, 4100),
  ('40000000-0000-0000-0000-000000000001', 'G4', 'treble', 'G', 'G', true, 1900),
  ('40000000-0000-0000-0000-000000000001', 'D4', 'treble', 'D', 'D', true, 1400),
  ('40000000-0000-0000-0000-000000000001', 'F4', 'treble', 'F', 'F', true, 1600);
