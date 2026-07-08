-- Studio settings (name + lesson-duration template blocks) and beta waitlist.
--
-- studio_policies doubles as the per-teacher studio settings row (§3 —
-- everything studio-specific is a setting, never hardcoded).

ALTER TABLE studio_policies
  ADD COLUMN studio_name text NOT NULL DEFAULT '',
  ADD COLUMN lesson_duration_options int[] NOT NULL DEFAULT '{30,45,60}';

COMMENT ON COLUMN studio_policies.lesson_duration_options IS
  'Template time blocks (minutes) offered when creating slots and one-off lessons.';

-- Beta waitlist: written by the public login page via service role only.
-- RLS is enabled with NO policies — anon/authenticated cannot touch it.
CREATE TABLE waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE waitlist TO service_role;
