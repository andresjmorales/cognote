-- Clear key signature from all note-identification (music notation) plans.
-- The app does not show key signature on the staff for note-ID; this makes the stored value explicit.
-- Safe to run: only updates plan_type = 'note_identification'. Other plan types are unchanged.
-- Column stays NOT NULL; we set to empty string so no migration is required.
--
-- Run locally:  psql $DATABASE_URL -f supabase/scripts/clear-note-plan-key-signatures.sql
-- Or in Supabase SQL Editor: paste and run the UPDATE below.

UPDATE plans
SET key_signature = ''
WHERE plan_type = 'note_identification';
