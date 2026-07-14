-- Hosted subscription entitlements (COGNOTE_DEPLOYMENT=hosted) + student archive
-- for free-tier soft limits. Self-hosted deployments ignore hosted_plan.

alter table public.teachers
  add column if not exists hosted_plan text not null default 'free',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists gifted_until timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists founding_number integer;

alter table public.teachers
  drop constraint if exists teachers_hosted_plan_check;

alter table public.teachers
  add constraint teachers_hosted_plan_check
  check (hosted_plan in ('free', 'trial', 'pro', 'founding', 'gifted'));

comment on column public.teachers.hosted_plan is
  'Hosted CogNote plan (free/trial/pro/founding/gifted). Ignored when COGNOTE_DEPLOYMENT=self_hosted.';
comment on column public.teachers.stripe_customer_id is
  'Platform Stripe customer for CogNote hosted subscription — not teacher BYO lesson Stripe.';
comment on column public.teachers.stripe_subscription_id is
  'Platform Stripe subscription id for CogNote Hosted Pro.';

alter table public.students
  add column if not exists archived_at timestamptz;

comment on column public.students.archived_at is
  'When set, student is archived and does not count toward hosted free-tier active student caps.';

create index if not exists students_teacher_active_idx
  on public.students (teacher_id)
  where archived_at is null;
