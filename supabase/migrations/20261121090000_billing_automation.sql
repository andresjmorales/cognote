-- Billing automation: scheduled draft invoices and one payment reminder.
-- Apply BEFORE deploying the app: the cron routes read these columns and the
-- settings form writes payment_terms_days.

alter table public.studio_policies
  add column if not exists payment_terms_days smallint not null default 14;

alter table public.studio_policies
  drop constraint if exists studio_policies_payment_terms_days_check;
alter table public.studio_policies
  add constraint studio_policies_payment_terms_days_check
  check (payment_terms_days between 0 and 120);

comment on column public.studio_policies.payment_terms_days is
  'Days after an invoice is sent before it counts as overdue. 0 = due on send.';

alter table public.invoices
  add column if not exists reminder_sent_at timestamptz;

comment on column public.invoices.reminder_sent_at is
  'When the single overdue reminder was attempted. Null = never reminded.';

-- A prepaid package is invoiced on its purchase day, so two packages for one
-- family on one day share a period. That is not a duplicate lesson invoice, so
-- invoice kind has to be explicit rather than inferred from the dates.
alter table public.invoices
  add column if not exists source text not null default 'lessons';

alter table public.invoices
  drop constraint if exists invoices_source_check;
alter table public.invoices
  add constraint invoices_source_check check (source in ('lessons', 'credit_package'));

comment on column public.invoices.source is
  'lessons = generated from delivered lessons; credit_package = a prepaid package purchase.';

-- Backfill: every invoice already referenced by a credit package is a purchase.
update public.invoices i
   set source = 'credit_package'
 where exists (
   select 1 from public.credit_packages p where p.invoice_id = i.id
 );

-- One live LESSON invoice per family per period. Draft generation is idempotent
-- at the application level (already-invoiced lessons are skipped), but two
-- overlapping runs can both find an empty set and both insert. Voided invoices
-- are exempt so a mistaken invoice can be replaced, and purchase invoices are
-- exempt because packages are billed on their purchase day.
--
-- Fails loudly rather than aborting the whole migration with a bare unique
-- violation: if it raises, resolve the duplicates it names (void the ones that
-- should not be live) and re-run.
do $$
declare
  dupes text;
begin
  select string_agg(format('teacher=%s guardian=%s period=%s..%s (%s rows)',
                           teacher_id, guardian_id, period_start, period_end, n), E'\n')
    into dupes
    from (
      select teacher_id, guardian_id, period_start, period_end, count(*) as n
        from public.invoices
       where status <> 'void' and source = 'lessons'
       group by teacher_id, guardian_id, period_start, period_end
      having count(*) > 1
    ) d;

  if dupes is not null then
    raise exception E'Duplicate live lesson invoices exist; void the extras before applying:\n%', dupes;
  end if;
end $$;

create unique index if not exists invoices_family_period_lessons_unique
  on public.invoices (teacher_id, guardian_id, period_start, period_end)
  where status <> 'void' and source = 'lessons';

-- Add the new bell type to the existing allowlist.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'portal_cancel', 'invoice_paid', 'event_rsvp', 'welcome', 'invoice_drafts_ready'
  ));
