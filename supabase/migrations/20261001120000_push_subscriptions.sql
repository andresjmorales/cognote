-- One row per browser/device that a teacher has enabled push on. The endpoint is
-- the push service URL and is unique per device+registration, so it is the natural
-- key for an upsert; re-subscribing the same device refreshes keys in place.
-- Stale rows are deleted by the sender when the push service answers 404/410.

CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_teacher ON push_subscriptions (teacher_id);

COMMENT ON TABLE push_subscriptions IS
  'Web Push subscriptions for teacher notifications; one row per device.';

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A teacher may only touch their own devices. The sender accepts the CALLER's
-- client, which may be the user-scoped one: its query filters by teacher_id and
-- this policy permits the owner's own rows, so RLS is no obstacle. It deletes
-- stale rows on 404/410.
CREATE POLICY push_subscriptions_teacher ON push_subscriptions
  FOR ALL USING (teacher_id = auth.uid());

-- Required since May 2026 or the Data API answers 42501 (CONTRIBUTING.md).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions
  TO anon, authenticated, service_role;
