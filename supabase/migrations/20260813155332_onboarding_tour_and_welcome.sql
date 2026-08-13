-- First-run tour flag and a one-time welcome notification type.
-- Existing teachers are marked complete so only new accounts see the tour.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at timestamptz;

COMMENT ON COLUMN public.teachers.onboarding_tour_completed_at IS
  'Set when the teacher finishes or skips the first-run tour. NULL means show the tour.';

UPDATE public.teachers
  SET onboarding_tour_completed_at = COALESCE(onboarding_tour_completed_at, created_at)
  WHERE onboarding_tour_completed_at IS NULL;

GRANT UPDATE (onboarding_tour_completed_at) ON public.teachers TO authenticated;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('portal_cancel', 'invoice_paid', 'event_rsvp', 'welcome'));

CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_welcome_per_teacher
  ON public.notifications (teacher_id)
  WHERE type = 'welcome';
