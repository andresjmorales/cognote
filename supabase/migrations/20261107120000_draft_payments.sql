-- Payments on draft invoices (issue #141).
--
-- A teacher can record payments (full or partial) on a draft, so an invoice
-- for lessons that are already paid never has to be sent, and so never shows
-- up in the family portal as owed. "sent" keeps meaning "the family was sent
-- this invoice" (sent_at is set).
--
-- Changes:
--   * A draft's subtotal can't drop below the payments recorded on it.
--   * Removing a payment from a paid invoice that was never sent
--     (sent_at IS NULL) reopens it to draft, not sent: it leaves the portal
--     and its line items can be edited again. Invoices that were sent still
--     reopen to sent.
--   * Exception: a prepaid-credits invoice whose credits are already used
--     can't go back to draft (credits are only usable while their invoice is
--     sent or paid), so that payment removal is refused.

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

  IF NEW.status = 'draft' AND NEW.subtotal_cents IS DISTINCT FROM OLD.subtotal_cents THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO paid_cents
      FROM payments WHERE invoice_id = OLD.id;
    IF NEW.subtotal_cents < paid_cents THEN
      RAISE EXCEPTION 'Invoice % already has % cents of payments; its total cannot go below that', OLD.id, paid_cents;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'paid' AND NEW.status IN ('sent', 'draft') THEN
      -- draft only for an invoice that was never sent; sent only for one
      -- that was.
      IF (NEW.status = 'draft') <> (OLD.sent_at IS NULL) THEN
        RAISE EXCEPTION 'Invalid invoice status transition: % -> %', OLD.status, NEW.status;
      END IF;
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

CREATE OR REPLACE FUNCTION reopen_underpaid_invoice()
RETURNS trigger AS $$
DECLARE
  inv        invoices%ROWTYPE;
  paid_cents bigint;
BEGIN
  SELECT * INTO inv FROM invoices WHERE id = OLD.invoice_id;
  -- Parent already deleted (cascade) or not paid: nothing to reopen.
  IF NOT FOUND OR inv.status <> 'paid' THEN
    RETURN OLD;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO paid_cents
    FROM payments WHERE invoice_id = OLD.invoice_id;
  IF paid_cents >= inv.subtotal_cents THEN
    RETURN OLD;
  END IF;

  IF inv.sent_at IS NULL AND EXISTS (
    SELECT 1
      FROM credit_packages p
      JOIN credit_redemptions r ON r.package_id = p.id
     WHERE p.invoice_id = inv.id
  ) THEN
    RAISE EXCEPTION 'Invoice % sold prepaid credits that are already used; return them before removing this payment', inv.id;
  END IF;

  UPDATE invoices
     SET status = CASE WHEN inv.sent_at IS NULL THEN 'draft' ELSE 'sent' END,
         paid_at = NULL,
         payment_method = NULL
   WHERE id = inv.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Backfill: the old reopen trigger moved never-sent invoices to 'sent'
-- (sent_at stays NULL; only the send path sets it), which put them in the
-- family portal as owed without the family ever being sent them. Return them
-- to draft, except prepaid-credits invoices whose credits are in use. The
-- status-transition guard doesn't allow sent -> draft, so lift it for this.
ALTER TABLE invoices DISABLE TRIGGER invoices_immutability;
UPDATE invoices i
   SET status = 'draft'
 WHERE i.status = 'sent'
   AND i.sent_at IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM credit_packages p
       JOIN credit_redemptions r ON r.package_id = p.id
      WHERE p.invoice_id = i.id
   );
ALTER TABLE invoices ENABLE TRIGGER invoices_immutability;
