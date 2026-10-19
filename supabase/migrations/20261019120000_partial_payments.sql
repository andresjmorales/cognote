-- Partial payments and correcting a mistaken manual payment (issue #129).
--
-- Status follows the payments: an invoice is paid once its payments cover
-- the subtotal. A teacher can record several manual payments against one
-- invoice, and can remove a manual payment entered by mistake; if that
-- leaves a paid invoice underpaid, it reopens (paid -> sent).
--
-- Guardrails, enforced here so they hold for any writer:
--   * paid -> sent is the only backwards status move, and only while the
--     recorded payments no longer cover the subtotal. Nothing returns to
--     draft; void stays terminal.
--   * Stripe payment rows cannot be edited or deleted. Stripe is the source
--     of truth for card payments; refunds happen in the Stripe dashboard.
--   * Payments on a void invoice cannot be edited or deleted (void is the
--     final record).
--   * A payment's amount, method, invoice, external id and timestamp are
--     immutable; only its note can change.
-- Cascades from deleting a draft/void invoice or a teacher still remove
-- payment rows (the parent invoice is already gone by then).

CREATE OR REPLACE FUNCTION enforce_invoice_immutability()
RETURNS trigger AS $$
DECLARE
  paid_cents bigint;
BEGIN
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'draft' THEN
    IF NEW.teacher_id    IS DISTINCT FROM OLD.teacher_id
    OR NEW.guardian_id   IS DISTINCT FROM OLD.guardian_id
    OR NEW.period_start  IS DISTINCT FROM OLD.period_start
    OR NEW.period_end    IS DISTINCT FROM OLD.period_end
    OR NEW.subtotal_cents IS DISTINCT FROM OLD.subtotal_cents
    OR NEW.currency      IS DISTINCT FROM OLD.currency
    OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Invoice % is %; its commercial fields are frozen', OLD.id, OLD.status;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'paid' AND NEW.status = 'sent' THEN
      SELECT COALESCE(SUM(amount_cents), 0) INTO paid_cents
        FROM payments WHERE invoice_id = OLD.id;
      IF paid_cents >= OLD.subtotal_cents THEN
        RAISE EXCEPTION 'Invoice % is fully paid; remove a payment before reopening it', OLD.id;
      END IF;
    ELSIF NOT (
      (OLD.status = 'draft')
      OR (OLD.status = 'sent' AND NEW.status IN ('paid', 'void'))
      OR (OLD.status = 'paid' AND NEW.status = 'void')
    ) THEN
      RAISE EXCEPTION 'Invalid invoice status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_payment_rules()
RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  SELECT status INTO parent_status FROM invoices WHERE id = OLD.invoice_id;

  -- Parent already deleted: this is the ON DELETE CASCADE cleanup.
  IF parent_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments cannot be changed or removed; refund in Stripe instead';
  END IF;

  IF parent_status = 'void' THEN
    RAISE EXCEPTION 'Invoice % is void; its payments are frozen', OLD.invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF (NEW.invoice_id, NEW.amount_cents, NEW.method, NEW.external_id, NEW.recorded_at)
     IS DISTINCT FROM
     (OLD.invoice_id, OLD.amount_cents, OLD.method, OLD.external_id, OLD.recorded_at)
  THEN
    RAISE EXCEPTION 'Only a payment''s note can be edited; remove and re-record it instead';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_rules ON payments;
CREATE TRIGGER payments_rules
  BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_rules();

-- Removing a payment from a paid invoice reopens it in the same statement,
-- so the invoice can never read "paid" while it is underpaid.
CREATE OR REPLACE FUNCTION reopen_underpaid_invoice()
RETURNS trigger AS $$
DECLARE
  paid_cents bigint;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO paid_cents
    FROM payments WHERE invoice_id = OLD.invoice_id;

  UPDATE invoices
     SET status = 'sent', paid_at = NULL, payment_method = NULL
   WHERE id = OLD.invoice_id
     AND status = 'paid'
     AND paid_cents < subtotal_cents;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_reopen_invoice ON payments;
CREATE TRIGGER payments_reopen_invoice
  AFTER DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION reopen_underpaid_invoice();
