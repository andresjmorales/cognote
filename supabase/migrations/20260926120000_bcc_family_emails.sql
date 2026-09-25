-- Optional BCC of the teacher's own address on family-facing email, so the
-- teacher keeps a copy of invoices, notes, assignments, cancellations, and
-- reminders. Off by default; the UI defaults the address to the account email.

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS bcc_family_emails boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bcc_email text
    CHECK (
      bcc_email IS NULL
      OR (
        length(bcc_email) <= 320
        AND bcc_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      )
    );

COMMENT ON COLUMN studio_policies.bcc_family_emails IS
  'BCC the teacher''s own address on family-facing email when true.';
COMMENT ON COLUMN studio_policies.bcc_email IS
  'Address to BCC on family email when bcc_family_emails is true; defaults to the account email in the UI.';
