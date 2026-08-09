-- Billing + Stripe BYO keys.
--
-- Attendance → invoice items is a pure function of (attendance, policy, rates).
-- Sent invoices freeze their line items; policy changes affect future
-- derivations only. Make-up lessons (lessons.makeup_for IS NOT NULL) are
-- non-billable by default so the original + make-up never both bill.

-- ── studio_policies: billing half ──────────────────────────────────────────
ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS bill_attended boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bill_no_show boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bill_teacher_cancel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_timely_student_cancel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_late_student_cancel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bill_makeup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_rate_cents int CHECK (default_rate_cents IS NULL OR default_rate_cents >= 0),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS invoice_cadence text NOT NULL DEFAULT 'monthly'
    CHECK (invoice_cadence IN ('monthly', 'manual')),
  ADD COLUMN IF NOT EXISTS payment_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'manual'
    CHECK (payment_provider IN ('manual', 'stripe')),
  ADD COLUMN IF NOT EXISTS stripe_secret_key text,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret text;

COMMENT ON COLUMN studio_policies.bill_attended IS
  'Whether attended lessons appear on invoices.';
COMMENT ON COLUMN studio_policies.default_rate_cents IS
  'Studio-wide fallback rate in cents. Slot rate → student default → this.';
COMMENT ON COLUMN studio_policies.payment_provider IS
  'manual = mark-as-paid + payment_instructions; stripe = BYO Checkout links.';

-- ── Rates on students and slots ────────────────────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS default_rate_cents int
    CHECK (default_rate_cents IS NULL OR default_rate_cents >= 0);

ALTER TABLE lesson_slots
  ADD COLUMN IF NOT EXISTS rate_cents int
    CHECK (rate_cents IS NULL OR rate_cents >= 0);

COMMENT ON COLUMN students.default_rate_cents IS
  'Per-student default lesson rate in cents; overridden by slot.rate_cents.';
COMMENT ON COLUMN lesson_slots.rate_cents IS
  'Per-slot lesson rate in cents; falls back to student then studio default.';

-- ── Invoices ───────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id                 uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  guardian_id                uuid NOT NULL REFERENCES guardians(id) ON DELETE RESTRICT,
  period_start               date NOT NULL,
  period_end                 date NOT NULL,
  status                     text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  subtotal_cents             int NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  currency                   text NOT NULL DEFAULT 'USD',
  sent_at                    timestamptz,
  paid_at                    timestamptz,
  payment_method             text CHECK (payment_method IS NULL OR payment_method IN ('manual', 'stripe')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_checkout_url        text,
  notes                      text NOT NULL DEFAULT '',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX idx_invoices_teacher ON invoices(teacher_id);
CREATE INDEX idx_invoices_guardian ON invoices(guardian_id);
CREATE INDEX idx_invoices_status ON invoices(teacher_id, status);

CREATE TABLE invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lesson_id    uuid REFERENCES lessons(id) ON DELETE SET NULL,
  description  text NOT NULL,
  quantity     int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cents   int NOT NULL CHECK (unit_cents >= 0),
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  sort_order   int NOT NULL DEFAULT 0
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  method       text NOT NULL CHECK (method IN ('manual', 'stripe')),
  external_id  text,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  note         text NOT NULL DEFAULT ''
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- RLS: teacher ownership. Portal reads go through service-role + token lookup.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_teacher ON invoices
  FOR ALL USING (teacher_id = auth.uid());

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_items_teacher ON invoice_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM invoices WHERE teacher_id = auth.uid())
  );

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_teacher ON payments
  FOR ALL USING (
    invoice_id IN (SELECT id FROM invoices WHERE teacher_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  invoices,
  invoice_items,
  payments
TO anon, authenticated, service_role;
