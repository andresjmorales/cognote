-- Seed data for LOCAL DEVELOPMENT ONLY.
-- Do NOT run this in production — it creates a test account with a known password.
-- Creates a test auth user + matching teacher, students, plans, schedule, billing,
-- skills, events, sheet-music metadata, and sample practice — enough to click
-- through most CogNote surfaces after `npx supabase db reset`.
--
-- LOCAL ONLY — never apply this file to a hosted/production project
-- (`db push` does not run seed.sql). Keep credentials out of README/CONTRIBUTING;
-- e2e reads them from e2e/helpers/auth.ts (keep in sync).
--
-- Stable tokens (keep in sync with e2e/helpers/auth.ts):
--   teacher email/password: see INSERT into auth.users below
--   /practice/dev-token-emma-week1
--   /practice/dev-token-liam-week1
--   /practice/dev-token-sophia-week2
--   /practice/dev-token-noah-symbols
--   /practice/dev-token-maya-keys
--   /portal/dev-portal-jordan
--   /portal/dev-portal-sam
--   /portal/dev-portal-noah

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

-- Teacher row matching the auth user above.
-- hosted_plan=pro so local COGNOTE_DEPLOYMENT=hosted is not capped at 5 students
-- (seed alone fills the free tier). Ignored when self_hosted.
INSERT INTO teachers (id, email, display_name, hosted_plan, onboarding_tour_completed_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'teacher@example.com', 'Ms. Johnson', 'pro', now());

-- Families: siblings (Jordan), single-child (Sam), adult-self (Noah)
INSERT INTO guardians (
  id, teacher_id, name, family_name, email, portal_token,
  secondary_name, secondary_email, email_recipients
) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Jordan Parent', 'Chen', 'jordan.parent@example.com', 'dev-portal-jordan',
   'Alex Parent', 'alex.parent@example.com', 'both'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Sam Guardian', 'Rivera', 'sam.guardian@example.com', 'dev-portal-sam',
   NULL, NULL, 'primary'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Noah Adult', 'Noah Adult', 'noah.adult@example.com', 'dev-portal-noah',
   NULL, NULL, 'primary');

-- Students: siblings, child with family, adult-of-one, practice-only (no portal)
INSERT INTO students (
  id, teacher_id, name, parent_contact, guardian_id,
  birthdate, level, practice_start_date, teacher_notes, default_rate_cents
) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Emma', 'emma.parent@example.com', '50000000-0000-0000-0000-000000000001',
   (CURRENT_DATE - interval '9 years')::date, 'Faber 2A',
   date_trunc('year', CURRENT_DATE - interval '2 years')::date,
   'Working on five-finger patterns; loves stickers.', NULL),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Liam', 'liam.parent@example.com', '50000000-0000-0000-0000-000000000001',
   (CURRENT_DATE - interval '7 years')::date, 'Faber 1B',
   date_trunc('year', CURRENT_DATE - interval '1 year')::date,
   'Shorter lessons; keep repertoire fun.', NULL),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Sophia', NULL, '50000000-0000-0000-0000-000000000002',
   (CURRENT_DATE - interval '11 years')::date, 'RCM Prep A', NULL,
   '', 5000),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Noah', 'noah.adult@example.com', '50000000-0000-0000-0000-000000000003',
   (CURRENT_DATE - interval '34 years')::date, NULL, (CURRENT_DATE - interval '6 months')::date,
   'Adult beginner — symbols & theory focus.', 6000),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Maya', NULL, NULL,
   NULL, NULL, NULL,
   'Practice-only trial — no family portal yet.', NULL);

-- Studio policy: rates, streaks, portal about, notifications defaults
INSERT INTO studio_policies (
  teacher_id, studio_name, timezone, cancellation_window_hours, lesson_duration_options,
  default_rate_cents, rate_basis, currency, invoice_cadence,
  payment_instructions, payment_provider,
  streaks_enabled, streak_count_quiz, streak_count_free_practice, streak_count_flashcards,
  studio_website, studio_contact, studio_info,
  timely_cancel_earns_makeup, teacher_cancel_earns_makeup
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Piano Studio',
  'America/Chicago',
  24,
  '{30,45,60}',
  4500,
  'per_hour',
  'USD',
  'monthly',
  'Venmo @TestPianoStudio or Zelle teacher@example.com. Due within 14 days.',
  'manual',
  true,
  true,
  false,
  true,
  'https://example.com/test-piano-studio',
  'Ms. Johnson · teacher@example.com · (555) 010-2000',
  'Private piano lessons in a friendly home studio. Parking on the street; please remove shoes at the door.',
  true,
  true
);

-- Recurring weekly slots: Emma Tue 4pm, Liam Tue 4:30pm, Sophia Thu 5pm, Noah Wed 6pm
INSERT INTO lesson_slots (id, teacher_id, student_id, day_of_week, start_time, duration_minutes, start_date, rate_cents) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 2, '16:00', 30, CURRENT_DATE - 14, NULL),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', 2, '16:30', 30, CURRENT_DATE - 14, NULL),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 4, '17:00', 45, CURRENT_DATE - 14, 5000),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000004', 3, '18:00', 45, CURRENT_DATE - 14, 6000);

-- Helper: last week's Tuesday (Emma/Liam) in America/Chicago local terms
-- dow: 0=Sun … so "days since last Tuesday" = (EXTRACT(dow) + 5) % 7 + 1

-- Emma: last Tue attended + family note
INSERT INTO lessons (id, teacher_id, student_id, slot_id, lesson_date, starts_at, duration_minutes) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1),
   ((CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1)) + time '16:00') AT TIME ZONE 'America/Chicago',
   30);

INSERT INTO attendance (id, lesson_id, status) VALUES
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'attended');

INSERT INTO lesson_notes (lesson_id, body, private_body, shared_with_parent) VALUES
  ('70000000-0000-0000-0000-000000000001',
   'Great work on Middle C position today. This week: practice the C major five-finger pattern, hands separately, 10 minutes a day.',
   'Remind parent about recital repertoire choice next week.',
   true);

-- Liam: timely student cancel two Tuesdays ago → make-up credit + scheduled make-up
INSERT INTO lessons (id, teacher_id, student_id, slot_id, lesson_date, starts_at, duration_minutes) VALUES
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
   CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1) - 7,
   ((CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1) - 7) + time '16:30') AT TIME ZONE 'America/Chicago',
   30);

INSERT INTO attendance (id, lesson_id, status, notice_at, cancel_note) VALUES
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002',
   'student_cancel',
   ((CURRENT_DATE - ((EXTRACT(dow FROM CURRENT_DATE)::int + 5) % 7 + 1) - 7) + time '16:30') AT TIME ZONE 'America/Chicago'
     - interval '48 hours',
   'Soccer tournament — can we make up Friday?');

-- Make-up for Liam (upcoming Friday 4pm), linked to the cancel attendance
INSERT INTO lessons (id, teacher_id, student_id, slot_id, lesson_date, starts_at, duration_minutes, makeup_for) VALUES
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', NULL,
   CURRENT_DATE + ((12 - EXTRACT(dow FROM CURRENT_DATE)::int) % 7),
   ((CURRENT_DATE + ((12 - EXTRACT(dow FROM CURRENT_DATE)::int) % 7)) + time '16:00') AT TIME ZONE 'America/Chicago',
   30,
   '80000000-0000-0000-0000-000000000002');

-- Plans: note ID (existing) + symbols + key signatures
INSERT INTO plans (
  id, teacher_id, name, is_template, clef, key_signature,
  questions_per_lesson, answer_choices, notes, plan_type, symbols,
  key_sig_scale_mode, key_signatures, show_hints, labels
) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Week 1 — Middle C Position', true, 'treble', 'C major', 10, 4,
   '["C4","D4","E4","F4","G4"]'::jsonb, 'note_identification', '[]'::jsonb,
   'major', '[]'::jsonb, true, '{Easy,Fundamentals}'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Week 2 — Treble Staff Lines', true, 'treble', 'C major', 10, 4,
   '["E4","G4","B4","D5","F5"]'::jsonb, 'note_identification', '[]'::jsonb,
   'major', '[]'::jsonb, true, '{Easy}'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Bass Clef Intro', true, 'bass', 'C major', 8, 4,
   '["G2","A2","B2","C3","D3","E3","F3","G3"]'::jsonb, 'note_identification', '[]'::jsonb,
   'major', '[]'::jsonb, true, '{Intermediate}'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Dynamics & Tempo Terms', true, 'treble', 'C major', 8, 4,
   '[]'::jsonb, 'symbol_concepts',
   '[
     {"id":"p","symbol":"p","term":"Piano","definition":"Soft"},
     {"id":"f","symbol":"f","term":"Forte","definition":"Loud"},
     {"id":"mp","symbol":"mp","term":"Mezzo-piano","definition":"Moderately soft"},
     {"id":"mf","symbol":"mf","term":"Mezzo-forte","definition":"Moderately loud"},
     {"id":"allegro","symbol":"Allegro","term":"Allegro","definition":"Fast and lively"},
     {"id":"andante","symbol":"Andante","term":"Andante","definition":"At a walking pace"}
   ]'::jsonb,
   'major', '[]'::jsonb, true, '{Fundamentals}'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Major Key Signatures', true, 'treble', 'C major', 8, 4,
   '[]'::jsonb, 'key_signature_identification', '[]'::jsonb,
   'major',
   '["C major","G major","D major","F major","Bb major","A major"]'::jsonb,
   true, '{Theory}');

-- Assignments (stable practice tokens)
INSERT INTO student_plans (id, student_id, plan_id, token) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'dev-token-emma-week1'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', 'dev-token-liam-week1'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000002', 'dev-token-sophia-week2'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004',
   '20000000-0000-0000-0000-000000000004', 'dev-token-noah-symbols'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000005', 'dev-token-maya-keys');

-- Practice sessions for Emma (streak-friendly: today / yesterday / 2 days ago)
INSERT INTO practice_sessions (id, student_plan_id, mode, started_at, completed_at, total_correct, total_incorrect, total_questions) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'lesson', now() - interval '2 days', now() - interval '2 days' + interval '5 minutes', 8, 2, 10),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'lesson', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes', 9, 1, 10),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
   'lesson', now() - interval '3 hours', now() - interval '3 hours' + interval '6 minutes', 10, 0, 10),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
   'flashcard', now() - interval '1 day' + interval '1 hour',
   now() - interval '1 day' + interval '1 hour' + interval '3 minutes', 0, 0, 0);

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

-- Flashcard SRS state for Emma (a few cards due / graduated)
INSERT INTO flashcard_progress (
  student_plan_id, item_type, note, clef, ease_factor, interval_days, repetitions, next_review, last_reviewed
) VALUES
  ('30000000-0000-0000-0000-000000000001', 'note', 'C4', 'treble', 2.6, 3, 2,
   now() + interval '1 day', now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000001', 'note', 'E4', 'treble', 2.3, 1, 1,
   now() - interval '2 hours', now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000001', 'note', 'G4', 'treble', 2.1, 0, 0,
   now() - interval '1 day', NULL);

-- Skills (same default names the app would lazy-seed)
INSERT INTO skill_dimensions (id, teacher_id, name, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Musicianship', 0),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Rhythm', 1),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sight Reading', 2),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Technique', 3),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Musicality', 4),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Theory', 5);

INSERT INTO skill_assessments (dimension_id, student_id, rating, note, assessed_on) VALUES
  ('a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 3, 'Steady improvement', CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, NULL, CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, NULL, CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 2, 'Relaxed wrists', CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 3, NULL, CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 2, NULL, CURRENT_DATE - 21),
  ('a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 4, NULL, CURRENT_DATE - 7),
  ('a1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 3, 'Counting aloud helped', CURRENT_DATE - 7),
  ('a1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, NULL, CURRENT_DATE - 7),
  ('a1000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 3, NULL, CURRENT_DATE - 7);

-- Billing: draft invoice (Jordan / Emma+Liam period) + paid invoice (Sam / Sophia)
INSERT INTO invoices (
  id, teacher_id, guardian_id, period_start, period_end, status,
  subtotal_cents, currency, sent_at, paid_at, payment_method, notes
) VALUES
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
   'draft', 2250, 'USD', NULL, NULL, NULL,
   'Includes Emma''s attended lesson this cycle.'),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000002',
   (date_trunc('month', CURRENT_DATE) - interval '1 month')::date,
   (date_trunc('month', CURRENT_DATE) - interval '1 day')::date,
   'paid', 3750, 'USD',
   now() - interval '20 days', now() - interval '12 days', 'manual',
   'Thank you!');

INSERT INTO invoice_items (invoice_id, lesson_id, description, quantity, unit_cents, amount_cents, sort_order) VALUES
  ('b1000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
   'Emma — 30 min lesson (attended)', 1, 2250, 2250, 0),
  ('b1000000-0000-0000-0000-000000000002', NULL,
   'Sophia — 45 min lessons (prior month)', 1, 3750, 3750, 0);

INSERT INTO payments (invoice_id, amount_cents, method, note, recorded_at) VALUES
  ('b1000000-0000-0000-0000-000000000002', 3750, 'manual', 'Venmo', now() - interval '12 days');

-- Sheet music library metadata only (no Storage object — open/download will 404 until re-uploaded).
-- Still useful for Music list + assignment UI / portal section chrome.
INSERT INTO music_library_items (
  id, teacher_id, title, composer, arranger, format, original_filename,
  storage_path, mime_type, byte_size, sha256, tags, source, license_code, attribution
) VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Minuet in G (seed placeholder)', 'attrib. Bach', '', 'musicxml',
   'minuet-in-g.musicxml',
   '00000000-0000-0000-0000-000000000001/c1000000-0000-0000-0000-000000000001/minuet-in-g.musicxml',
   'application/vnd.recordare.musicxml+xml', 512,
   'seed000000000000000000000000000000000000000000000000000000000001',
   '{baroque,easy}', 'teacher_upload', 'public_domain',
   'Seed row for local UI — re-upload a real file to open it.');

INSERT INTO sheet_music_assignments (id, music_item_id, student_id, assignment_note, due_date) VALUES
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'Hands separate first; aim for steady quarter notes.',
   CURRENT_DATE + 14);

-- In-app notification (portal cancel style)
INSERT INTO notifications (id, teacher_id, type, title, body, href, read_at, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'portal_cancel',
   'Liam cancelled a lesson',
   'Soccer tournament — can we make up Friday?',
   '/schedule',
   NULL,
   now() - interval '10 days');

-- Sample studio recital (upcoming Saturday)
INSERT INTO events (id, teacher_id, title, description, location, starts_at, ends_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Spring Studio Recital',
   'Students perform short pieces for families. Arrive 15 minutes early.',
   'Community Hall',
   date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
     + interval '6 days' + interval '15 hours',
   date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
     + interval '6 days' + interval '17 hours');

INSERT INTO event_students (event_id, student_id, repertoire, sort_order) VALUES
  ('e1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Middle C Waltz', 0),
  ('e1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Ode to Joy (RH)', 1),
  ('e1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Lightly Row', 2),
  ('e1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
   'Simple Gifts (arr.)', 3);

INSERT INTO event_rsvps (event_id, guardian_id, status, party_size, note, responded_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'yes', 4, 'Grandparents coming too', now() - interval '1 day'),
  ('e1000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002',
   'pending', NULL, '', NULL),
  ('e1000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003',
   'maybe', 1, 'Work schedule TBD', now() - interval '2 hours');
