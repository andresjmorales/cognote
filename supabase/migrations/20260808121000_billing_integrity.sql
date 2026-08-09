-- Billing integrity at the database level.
--
-- "Invoices freeze at send" was previously enforced only in API route code.
-- These triggers make the guarantee hold for any writer (Data API, SQL
-- editor, future routes):
--   * Commercial fields (family, period, amounts, currency) are immutable
--     once an invoice leaves draft.
--   * Status only moves forward: draft -> sent/paid/void, sent -> paid/void,
--     paid -> void. Nothing returns to draft; void is terminal.
--   * Line items of sent/paid invoices cannot be edited or deleted.
--     (INSERT stays allowed so restoring a studio export into a fresh
--     account can recreate items under already-sent invoices; a stray insert
--     cannot change the frozen invoice subtotal.)
--   * Sent/paid invoices cannot be deleted (app allows draft/void only).
--   * One payment row per Stripe payment intent per invoice, so duplicate
--     webhook deliveries cannot double-record a payment.
--
-- No-op UPDATEs are always allowed: the studio import upserts rows with
-- unchanged values.

CREATE OR REPLACE FUNCTION enforce_invoice_immutability()
RETURNS trigger AS $$
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
    IF NOT (
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

DROP TRIGGER IF EXISTS invoices_immutability ON invoices;
CREATE TRIGGER invoices_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_immutability();

CREATE OR REPLACE FUNCTION enforce_invoice_delete_rules()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('sent', 'paid') THEN
    RAISE EXCEPTION 'Invoice % is %; only draft or void invoices can be deleted', OLD.id, OLD.status;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_delete_rules ON invoices;
CREATE TRIGGER invoices_delete_rules
  BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_delete_rules();

CREATE OR REPLACE FUNCTION enforce_invoice_item_freeze()
RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  -- Deleting a lesson cascades ON DELETE SET NULL onto invoice_items.
  -- That reference cleanup is fine on frozen invoices as long as nothing
  -- else about the line changes.
  IF TG_OP = 'UPDATE'
    AND OLD.lesson_id IS NOT NULL
    AND NEW.lesson_id IS NULL
    AND (NEW.invoice_id, NEW.description, NEW.quantity, NEW.unit_cents, NEW.amount_cents, NEW.sort_order)
        IS NOT DISTINCT FROM
        (OLD.invoice_id, OLD.description, OLD.quantity, OLD.unit_cents, OLD.amount_cents, OLD.sort_order)
  THEN
    RETURN NEW;
  END IF;

  SELECT status INTO parent_status FROM invoices WHERE id = OLD.invoice_id;

  IF parent_status IN ('sent', 'paid') THEN
    RAISE EXCEPTION 'Invoice % is %; its line items are frozen', OLD.invoice_id, parent_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_items_freeze ON invoice_items;
CREATE TRIGGER invoice_items_freeze
  BEFORE UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_item_freeze();

-- Duplicate Stripe webhook deliveries must not double-record payments.
-- Manual payments (external_id IS NULL) can repeat (partial payments).
CREATE UNIQUE INDEX IF NOT EXISTS payments_invoice_external_unique
  ON payments (invoice_id, external_id)
  WHERE external_id IS NOT NULL;
