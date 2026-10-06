-- Read-only teacher schedule feed token (issue #120).
--
-- Mirrors guardians.portal_token: unguessable, revocable by rotation, and
-- resolved with the service-role client in application code — never through
-- the Data API, which has no access to public.teachers.
--
-- The volatile DEFAULT backfills every existing row on ADD COLUMN, and new
-- teachers (ensure-teacher.ts inserts, seed.sql) receive one automatically.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS calendar_token text NOT NULL
    DEFAULT rtrim(translate(encode(gen_random_bytes(16), 'base64'), '+/', '-_'), '=');

COMMENT ON COLUMN public.teachers.calendar_token IS
  'Revocable token for the read-only teacher .ics feed. Rotate to revoke the old URL.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_calendar_token
  ON public.teachers (calendar_token);

-- The rotate route writes this column through the authenticated (RLS) client,
-- which needs its own column-level UPDATE grant: 20260808120000_rls_hardening.sql
-- revoked table-level INSERT/UPDATE/DELETE and re-granted only the profile
-- columns. Follows the onboarding_tour_completed_at precedent.
GRANT UPDATE (calendar_token) ON public.teachers TO authenticated;
