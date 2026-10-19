-- Prepaid lesson credits (issue #119).
--
-- A teacher sells a family a package of fixed-count credits for one student
-- and one lesson length ("10 × 30-min lessons"). The sale is an ordinary
-- invoice with one credit_package line, paid through the usual mark-paid or
-- Stripe flow. Credits can be used once that invoice is sent or paid.
--
-- When invoices are generated, each billable lesson of the package's length
-- uses a credit instead of a lesson line; the choice is written to
-- credit_redemptions. Once a student runs out, lessons bill normally again.
-- Packages may carry an optional expiry date, checked against the lesson
-- date.
--
-- Guardrails, enforced here so they hold for any writer:
--   * A lesson is either redeemed or on a non-void invoice as a lesson line,
--     never both. (Travel fees on a redeemed home visit still bill.)
--   * A package never covers more lessons than it has credits, and only
--     covers lessons of its student and length, inside its dates, while its
--     invoice is sent or paid.
--   * A package invoice cannot be voided while any of its credits are used.
--   * A package's credits, length, price, student and invoice are fixed;
--     only its expiry date can change.

-- ── invoice_items.kind ─────────────────────────────────────────────────────
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lesson'
    CHECK (kind IN ('lesson', 'travel', 'credit_package'));

COMMENT ON COLUMN invoice_items.kind IS
  'lesson = a lesson charge; travel = home-visit travel fee; credit_package = prepaid credits sale.';

-- Existing travel lines were only distinguishable by description. Line items
-- of sent/paid invoices are frozen, so lift the freeze for this backfill.
ALTER TABLE invoice_items DISABLE TRIGGER invoice_items_freeze;
UPDATE invoice_items
   SET kind = 'travel'
 WHERE kind = 'lesson'
   AND description LIKE 'Travel fee - %';
ALTER TABLE invoice_items ENABLE TRIGGER invoice_items_freeze;

-- ── credit_packages ────────────────────────────────────────────────────────
CREATE TABLE credit_packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- Deleting the (draft or void) purchase invoice removes the package.
  invoice_id       uuid NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  credits          int NOT NULL CHECK (credits > 0),
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  price_cents      int NOT NULL CHECK (price_cents >= 0),
  starts_on        date NOT NULL,
  expires_on       date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR expires_on >= starts_on)
);
CREATE INDEX idx_credit_packages_teacher ON credit_packages(teacher_id);
CREATE INDEX idx_credit_packages_student ON credit_packages(student_id);

COMMENT ON TABLE credit_packages IS
  'Prepaid lesson credits for one student and lesson length; sold through invoice_id.';

-- ── credit_redemptions ─────────────────────────────────────────────────────
CREATE TABLE credit_redemptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- NO ACTION (checked at end of statement), not RESTRICT: deleting a
  -- student or teacher removes the redemptions through lessons in the same
  -- statement. On its own, a package with used credits can't be deleted.
  package_id uuid NOT NULL REFERENCES credit_packages(id) ON DELETE NO ACTION,
  -- Deleting a lesson gives its credit back.
  lesson_id  uuid NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_redemptions_package ON credit_redemptions(package_id);

COMMENT ON TABLE credit_redemptions IS
  'Ledger: lesson_id was paid by one credit of package_id instead of being invoiced.';

-- ── Guards ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_credit_redemption_rules()
RETURNS trigger AS $$
DECLARE
  pkg     credit_packages%ROWTYPE;
  inv_status text;
  lsn     record;
  used    int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Credit redemptions cannot be edited; remove and re-create instead';
  END IF;

  -- Lock the package so concurrent redemptions can't overspend it.
  SELECT * INTO pkg FROM credit_packages WHERE id = NEW.package_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit package % not found', NEW.package_id;
  END IF;

  -- Lock the lesson so an invoice line and a redemption can't race past
  -- each other's check.
  SELECT id, teacher_id, student_id, lesson_date, duration_minutes INTO lsn
    FROM lessons WHERE id = NEW.lesson_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson % not found', NEW.lesson_id;
  END IF;

  IF NEW.teacher_id <> pkg.teacher_id OR lsn.teacher_id <> pkg.teacher_id THEN
    RAISE EXCEPTION 'Credit package and lesson belong to different teachers';
  END IF;
  IF lsn.student_id <> pkg.student_id THEN
    RAISE EXCEPTION 'Credit package % is for a different student', pkg.id;
  END IF;
  IF lsn.duration_minutes <> pkg.duration_minutes THEN
    RAISE EXCEPTION 'Credit package % covers % min lessons, not % min',
      pkg.id, pkg.duration_minutes, lsn.duration_minutes;
  END IF;
  IF lsn.lesson_date < pkg.starts_on
     OR (pkg.expires_on IS NOT NULL AND lsn.lesson_date > pkg.expires_on) THEN
    RAISE EXCEPTION 'Lesson on % is outside credit package % dates', lsn.lesson_date, pkg.id;
  END IF;

  SELECT status INTO inv_status FROM invoices WHERE id = pkg.invoice_id;
  IF inv_status IS DISTINCT FROM 'sent' AND inv_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Credit package % can be used once its invoice is sent or paid', pkg.id;
  END IF;

  -- Excluding NEW.id lets a studio import re-upsert an existing row.
  SELECT count(*) INTO used FROM credit_redemptions
   WHERE package_id = pkg.id AND id <> NEW.id;
  IF used >= pkg.credits THEN
    RAISE EXCEPTION 'Credit package % has no credits left', pkg.id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
     WHERE ii.lesson_id = NEW.lesson_id
       AND ii.kind = 'lesson'
       AND i.status <> 'void'
  ) THEN
    RAISE EXCEPTION 'Lesson % is already invoiced; it cannot also use a credit', NEW.lesson_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_redemptions_rules ON credit_redemptions;
CREATE TRIGGER credit_redemptions_rules
  BEFORE INSERT OR UPDATE ON credit_redemptions
  FOR EACH ROW EXECUTE FUNCTION enforce_credit_redemption_rules();

-- The other half of "never both": a redeemed lesson gets no lesson line.
CREATE OR REPLACE FUNCTION enforce_invoice_item_not_redeemed()
RETURNS trigger AS $$
BEGIN
  IF NEW.lesson_id IS NULL OR NEW.kind <> 'lesson' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.lesson_id IS NOT DISTINCT FROM OLD.lesson_id
     AND NEW.kind IS NOT DISTINCT FROM OLD.kind THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM lessons WHERE id = NEW.lesson_id FOR NO KEY UPDATE;

  IF EXISTS (SELECT 1 FROM credit_redemptions WHERE lesson_id = NEW.lesson_id) THEN
    RAISE EXCEPTION 'Lesson % was paid with a prepaid credit; it cannot also be invoiced', NEW.lesson_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_items_not_redeemed ON invoice_items;
CREATE TRIGGER invoice_items_not_redeemed
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_item_not_redeemed();

-- Voiding a package invoice would leave used credits with no sale behind
-- them. Return the credits first.
CREATE OR REPLACE FUNCTION enforce_package_invoice_void()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'void' AND OLD.status <> 'void' AND EXISTS (
    SELECT 1
      FROM credit_packages p
      JOIN credit_redemptions r ON r.package_id = p.id
     WHERE p.invoice_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Invoice % sold prepaid credits that are already used; return them before voiding', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_package_void ON invoices;
CREATE TRIGGER invoices_package_void
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_package_invoice_void();

CREATE OR REPLACE FUNCTION enforce_credit_package_immutability()
RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.teacher_id, NEW.student_id, NEW.invoice_id, NEW.credits,
      NEW.duration_minutes, NEW.price_cents, NEW.starts_on, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.teacher_id, OLD.student_id, OLD.invoice_id, OLD.credits,
      OLD.duration_minutes, OLD.price_cents, OLD.starts_on, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Only a credit package''s expiry date can be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_packages_immutability ON credit_packages;
CREATE TRIGGER credit_packages_immutability
  BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION enforce_credit_package_immutability();

-- ── RLS + Data API ─────────────────────────────────────────────────────────
-- Portal reads go through service-role + token lookup, like invoices.
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_packages_teacher ON credit_packages
  FOR ALL USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid())
    AND invoice_id IN (SELECT id FROM invoices WHERE teacher_id = auth.uid())
  );

ALTER TABLE credit_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_redemptions_teacher ON credit_redemptions
  FOR ALL USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  credit_packages,
  credit_redemptions
TO anon, authenticated, service_role;
