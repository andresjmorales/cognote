-- Optional cancel-at timestamp for Hosted Pro (Stripe Customer Portal schedule cancel).

alter table public.teachers
  add column if not exists stripe_cancel_at timestamptz;

comment on column public.teachers.stripe_cancel_at is
  'When set, Hosted Pro cancels at this time (from Stripe cancel_at). Cleared when subscription is active without pending cancel.';
