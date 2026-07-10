-- Move previously unshared lesson note bodies into private_body so the
-- family-facing body only holds notes meant for the portal/email.
UPDATE lesson_notes
SET
  private_body = body,
  body = '',
  shared_with_parent = false
WHERE shared_with_parent = false
  AND btrim(body) <> ''
  AND btrim(private_body) = '';
