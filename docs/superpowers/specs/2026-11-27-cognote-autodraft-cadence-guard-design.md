# Design: guard auto-drafts against month-to-date cadence

**Date:** 2026-11-27
**Repo:** `andresjmorales/cognote`
**Branch:** `feat/billing-automation`
**Status:** Approved approach (Option 1); spec pending user review

## Problem

`invoice_cadence` and `auto_draft_invoices` are intentionally independent: the cadence dropdown only pre-fills the manual Generate dialog, while the auto-draft cron always creates previous-calendar-month drafts on days 1–3.

The current Settings UI allows the contradictory combination `invoice_cadence = 'manual'` (Month-to-date) with `auto_draft_invoices = true`. A studio can select Month-to-date, enable auto-drafts, and still receive previous-month drafts at the start of the month.

## Decision

Keep the cron schedule and the maintainer-requested decoupling. Make the UI and settings API enforce that auto-drafts are only available with the **Previous calendar month** cadence.

## Behaviour

### Settings → Billing (`BillingSettingsForm.tsx`)

- Selecting **Month-to-date** immediately unchecks **Auto-generate draft invoices each month**.
- While Month-to-date is selected, the auto-draft checkbox is disabled and unchecked.
- Disabled helper text: “Auto-drafts always bill the previous calendar month. Choose Previous calendar month to enable.”
- Switching back to **Previous calendar month** re-enables the checkbox but leaves it off; the teacher must explicitly opt in again.
- Saving a Month-to-date policy never sends `autoDraftInvoices: true`.

### Settings API (`app/api/settings/policy/route.ts`)

- Resolve the effective cadence (`body.invoiceCadence ?? currentPolicy.invoice_cadence`).
- If the request switches cadence to `manual`, force `auto_draft_invoices = false` in the same upsert, even when the client did not send the auto-draft field. This heals stale clients and prevents an invalid state.
- If the effective cadence is already `manual` and the request explicitly sets `autoDraftInvoices: true` without changing cadence, return **400** with: “Auto-drafts require Previous calendar month cadence.”
- Unchanged-when-absent behaviour remains for databases without the migration.

### Cron

No change. It continues to filter on `auto_draft_invoices = true` and always drafts the previous calendar month. The write-boundary guards prevent new invalid combinations.

## Existing invalid rows

Any row already saved as `invoice_cadence = 'manual'` + `auto_draft_invoices = true` is healed the next time that studio saves **Billing** settings with Month-to-date selected. No migration or data backfill is required for this UI-only guard.

## Testing

- `npm run typecheck` → 0 errors.
- `npm test` → all existing tests green.
- Manual dev verification:
  1. Select Month-to-date → checkbox disables and unchecks.
  2. Save → API stores `invoice_cadence = 'manual'`, `auto_draft_invoices = false`.
  3. Switch back to Previous calendar month → checkbox re-enables, remains off.
  4. Direct API attempt to set `autoDraftInvoices: true` with manual cadence → 400.

## Out of scope

- End-of-month or cadence-aware scheduling.
- Replacing the cadence dropdown with a combined automation control.
- Database CHECK constraints or cron-route cadence filtering.
