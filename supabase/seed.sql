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

-- Sample guardians (families) — Emma and Liam are siblings sharing one guardian
INSERT INTO guardians (id, teacher_id, name, email, portal_token) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Jordan Parent', 'jordan.parent@example.com', 'dev-portal-jordan'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Sam Guardian', 'sam.guardian@example.com', 'dev-portal-sam');

-- Sample students
INSERT INTO students (id, teacher_id, name, parent_contact, guardian_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Emma', 'emma.parent@example.com', '50000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Liam', 'liam.parent@example.com', '50000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sophia', NULL, '50000000-0000-0000-0000-000000000002');

-- Studio policy for the test teacher (defaults, Chicago time)
INSERT INTO studio_policies (teacher_id, studio_name, timezone, cancellation_window_hours, lesson_duration_options) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Piano Studio', 'America/Chicago', 24, '{30,45,60}');

-- Recurring weekly slots: Emma Tue 4pm, Liam Tue 4:30pm, Sophia Thu 5pm
INSERT INTO lesson_slots (id, teacher_id, student_id, day_of_week, start_time, duration_minutes, start_date) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 2, '16:00', 30, CURRENT_DATE - 14),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', 2, '16:30', 30, CURRENT_DATE - 14),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 4, '17:00', 45, CURRENT_DATE - 14);

-- One past materialized lesson for Emma (last week's Tuesday), attended, with a shared note
INSERT INTO lessons (id, teacher_id, student_id, slot_id, lesson_date, starts_at, duration_minutes) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1),
   ((CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1)) + time '16:00') AT TIME ZONE 'America/Chicago',
   30);

INSERT INTO attendance (id, lesson_id, status) VALUES
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'attended');

INSERT INTO lesson_notes (lesson_id, body, shared_with_parent) VALUES
  ('70000000-0000-0000-0000-000000000001',
   'Great work on Middle C position today. This week: practice the C major five-finger pattern, hands separately, 10 minutes a day.',
   true);

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

-- Sample studio recital (upcoming Saturday 3pm Chicago-ish UTC offset; relative)
INSERT INTO events (id, teacher_id, title, description, location, starts_at, ends_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Spring Studio Recital',
   'Students perform short pieces for families. Arrive 15 minutes early.',
   'Community Hall',
   date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
     + interval '6 days' + interval '15 hours',
   date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
     + interval '6 days' + interval '17 hours');

INSERT INTO event_students (event_id, student_id, repertoire, sort_order) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Middle C Waltz', 0),
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Ode to Joy (RH)', 1),
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Lightly Row', 2);

INSERT INTO event_rsvps (event_id, guardian_id, status, party_size, note, responded_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'yes', 4, 'Grandparents coming too', now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002',
   'pending', NULL, '', NULL);

