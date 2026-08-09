-- Families/guardians as a structured concept.
--
-- Guardians own the family-level concerns: portal access now, invoicing and
-- email later. Siblings share one guardian record.
--
-- DELIBERATE v1 LIMIT: one guardian per student (students.guardian_id).
-- Split households (divorced parents, separate invoices for the same kid)
-- are a real scenario but deferred — known v2 item, not a schema surprise.
-- The v2 shape would be a student_guardians join table.

CREATE TABLE guardians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text,
  phone        text,
  -- Unlike practice tokens, portal tokens are revocable: rotating the value
  -- invalidates the old link.
  portal_token text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guardians_teacher ON guardians(teacher_id);
CREATE INDEX idx_guardians_portal_token ON guardians(portal_token);

ALTER TABLE students
  ADD COLUMN guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL;
CREATE INDEX idx_students_guardian ON students(guardian_id);

COMMENT ON COLUMN students.guardian_id IS
  'v1: single guardian per student, on purpose. Split households need a student_guardians join table (known v2 item).';
COMMENT ON COLUMN students.parent_contact IS
  'DEPRECATED: legacy freeform contact, superseded by guardian_id. Kept for reference until fully migrated.';

-- Backfill: one guardian per distinct (teacher, parent_contact) value so
-- siblings sharing a contact string share a guardian. The freeform text
-- becomes the guardian name; if it looks like an email it also becomes email.
WITH distinct_contacts AS (
  SELECT DISTINCT teacher_id, btrim(parent_contact) AS contact
  FROM students
  WHERE parent_contact IS NOT NULL AND btrim(parent_contact) <> ''
)
INSERT INTO guardians (teacher_id, name, email, portal_token)
SELECT
  teacher_id,
  contact,
  CASE WHEN contact ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN contact END,
  translate(encode(gen_random_bytes(12), 'base64'), '+/', '-_')
FROM distinct_contacts;

UPDATE students s
SET guardian_id = g.id
FROM guardians g
WHERE s.teacher_id = g.teacher_id
  AND btrim(s.parent_contact) = g.name;

-- RLS: teacher-only. No anon policy — the portal page resolves tokens through
-- the service-role client in application code, same as practice tokens.
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardians_teacher ON guardians
  FOR ALL USING (teacher_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE guardians
TO anon, authenticated, service_role;
