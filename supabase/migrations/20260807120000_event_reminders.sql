-- Per-event opt-in for "day before" reminder emails to invited families.
alter table public.events
  add column send_reminder boolean not null default false,
  add column reminder_sent_at timestamptz;

comment on column public.events.send_reminder is
  'When true, cron emails invited families on the studio-local day before starts_at.';
comment on column public.events.reminder_sent_at is
  'Set when the day-before reminder batch was attempted (dedupe).';
