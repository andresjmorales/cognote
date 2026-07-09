-- Second guardian per family (two-parent households) + email routing.
--
-- A guardians row is really the *family* record: the primary guardian's
-- contact info plus an optional second guardian. Which guardian(s) receive
-- family emails is a per-family setting (email_recipients), never hardcoded.
-- Split households (separate portals/invoices per parent) remain the v2
-- student_guardians item — this covers the common "both parents want the
-- emails" case within one household.

ALTER TABLE guardians
  ADD COLUMN secondary_name  text,
  ADD COLUMN secondary_email text,
  ADD COLUMN secondary_phone text,
  ADD COLUMN email_recipients text NOT NULL DEFAULT 'primary'
    CHECK (email_recipients IN ('primary', 'secondary', 'both'));

COMMENT ON COLUMN guardians.email_recipients IS
  'Which guardian(s) receive family emails: primary, secondary, or both.';
