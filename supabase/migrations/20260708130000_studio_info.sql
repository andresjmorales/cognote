-- Phase 7: "Studio info" settings (ROADMAP §10 Phase 7) — human-readable
-- policies, website, and contact info the teacher writes once and families
-- see on their portal, so they know the studio's rules and can find their
-- way back to the studio's own site.

ALTER TABLE studio_policies
  ADD COLUMN studio_website text NOT NULL DEFAULT '',
  ADD COLUMN studio_contact text NOT NULL DEFAULT '',
  ADD COLUMN studio_info    text NOT NULL DEFAULT '';

COMMENT ON COLUMN studio_policies.studio_info IS
  'Human-readable studio policies/info shown on the family portal (free text).';
