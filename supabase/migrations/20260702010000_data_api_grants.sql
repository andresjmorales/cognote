-- Explicit Data API grants.
--
-- As of Supabase CLI/platform May 2026, tables in the public schema are no
-- longer automatically exposed to the Data API roles (anon, authenticated,
-- service_role); each table needs an explicit GRANT.
-- See https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- Row Level Security (see 20260302000001_rls_policies.sql) still controls
-- which rows each role can touch — these grants only opt the tables in.
-- IMPORTANT: every future migration that creates a table must include its own
-- GRANT statement like this one.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  teachers,
  students,
  plans,
  student_plans,
  practice_sessions,
  note_attempts,
  flashcard_progress
TO anon, authenticated, service_role;
