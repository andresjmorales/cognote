-- Portal cancellations, cancel notes, and teacher notifications.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS cancel_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN attendance.cancel_note IS
  'Optional note from family (portal) or teacher when marking student_cancel.';

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS notify_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_portal_cancel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_invoice_paid boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN studio_policies.notify_in_app IS
  'Show events in the teacher in-app notification bell.';
COMMENT ON COLUMN studio_policies.notify_email_portal_cancel IS
  'Email the teacher when a family cancels via the portal.';
COMMENT ON COLUMN studio_policies.notify_email_invoice_paid IS
  'Email the teacher when a Stripe invoice is paid online.';

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('portal_cancel', 'invoice_paid')),
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  href       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_teacher_created
  ON notifications (teacher_id, created_at DESC);
CREATE INDEX idx_notifications_teacher_unread
  ON notifications (teacher_id)
  WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_teacher ON notifications
  FOR ALL USING (teacher_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications
  TO anon, authenticated, service_role;
