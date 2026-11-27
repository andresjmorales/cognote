-- Billing automation opt-in: monthly drafts and overdue reminders.
-- Apply AFTER supabase/migrations/20261121090000_billing_automation.sql.
-- Apply BEFORE deploying the app code that reads these columns.

alter table public.studio_policies
  add column if not exists auto_draft_invoices boolean not null default false;

comment on column public.studio_policies.auto_draft_invoices is
  'When true, the daily cron drafts the previous month\'s invoices for this studio. Null/false = off.';

alter table public.studio_policies
  add column if not exists invoice_reminders_enabled_at timestamptz;

comment on column public.studio_policies.invoice_reminders_enabled_at is
  'When set, overdue invoice reminders only apply to invoices sent at or after this instant. Null = reminders off.';
