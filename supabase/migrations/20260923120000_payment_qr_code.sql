-- Optional payment QR code (e.g. PayNow, UPI, PIX, Venmo) shown on invoices
-- and the family portal for manual payments. Stored inline as a small
-- base64 PNG/JPEG data URL so PDF generation needs no Storage round-trip.

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS payment_qr_code text
    CHECK (
      payment_qr_code IS NULL
      OR (
        length(payment_qr_code) <= 400000
        AND payment_qr_code ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$'
      )
    );

COMMENT ON COLUMN studio_policies.payment_qr_code IS
  'Optional payment QR image as a data:image/(png|jpeg);base64 URL; shown with manual payment instructions.';
