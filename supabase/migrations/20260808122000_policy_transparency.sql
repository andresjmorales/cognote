-- Policy transparency for the family portal.
--
-- policies_updated_at is bumped by PUT /api/settings/policy only when a
-- family-relevant policy field changes (cancellation window, make-up rules,
-- billing rules). The portal shows a one-time "policies were updated" banner
-- when this timestamp is newer than the family's local dismissal marker.

ALTER TABLE public.studio_policies
  ADD COLUMN IF NOT EXISTS policies_updated_at timestamptz;
