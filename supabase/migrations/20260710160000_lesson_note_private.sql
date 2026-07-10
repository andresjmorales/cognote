-- Split lesson notes: body = family-facing; private_body = teacher-only.
-- shared_with_parent remains the portal gate (true when family body is non-empty).

ALTER TABLE lesson_notes
  ADD COLUMN IF NOT EXISTS private_body text NOT NULL DEFAULT '';

COMMENT ON COLUMN lesson_notes.body IS
  'Notes shared with the family (portal + email when sent).';
COMMENT ON COLUMN lesson_notes.private_body IS
  'Teacher-only notes for this lesson; never shown on the family portal.';
