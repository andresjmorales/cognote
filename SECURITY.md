# Security Policy

## Supported versions

Security fixes are applied on the default branch (`main`). Self-hosters should stay current with that branch (or tagged releases when they exist).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Email **security@cognote.studio** (or the maintainer listed on the GitHub repo) with:

- A short description of the issue and impact
- Steps to reproduce (or a proof of concept)
- Affected version / commit if known

We aim to acknowledge reports within a few business days. Please give us a reasonable window to fix and release before any public disclosure.

---

## Security model (how CogNote is designed)

CogNote is a multi-tenant studio app: each teacher’s data is isolated, and families access a narrow slice of data via unguessable links (no parent accounts).

### Authentication

- Teachers sign in with **Supabase Auth** (email/password).
- Teacher-facing routes under `app/(teacher)/` require a session; unauthenticated users are redirected to login.
- Optional beta gate: **`NEXT_PUBLIC_BETA_ONLY`** (UI) + **`BETA_ACCESS_CODE`** (server-only secret). Orthogonal to `COGNOTE_DEPLOYMENT`. Leave both unset for open self-hosted sign-ups. Failed code guesses are rate-limited per IP (best-effort in-memory).

### Authorization (database)

- **Row Level Security (RLS)** is enabled on application tables. Teacher policies typically scope rows with `teacher_id = auth.uid()` (or an equivalent ownership join).
- The browser uses the **anon key** + the user’s JWT. RLS is the primary guardrail for teacher data — do not disable it.
- New tables must include both RLS policies **and** explicit `GRANT`s to `anon` / `authenticated` / `service_role` (see README / `20260702010000_data_api_grants.sql`). Missing grants cause `permission denied`; missing RLS is a security bug.

### Service role

- **`SUPABASE_SERVICE_ROLE_KEY`** bypasses RLS. It must only be used on the **server** (portal token resolution, waitlist, Stripe webhooks, etc.).
- Never expose the service role key to the client, commit it, or put it in `NEXT_PUBLIC_*` variables.

### Family portal & practice links

- Each family has a **`portal_token`** (unguessable, revocable). The portal page resolves the token with the service-role client and only returns that family’s data.
- Practice assignments use similar **token URLs**. Treat tokens like passwords: send over HTTPS, don’t put them in public pages or analytics, and rotate from the Families UI if a link leaks.
- Portal actions (e.g. cancelling a lesson) re-check that the lesson belongs to a student of that guardian before writing.

### Secrets & payments

| Secret | Notes |
|--------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server only; full DB access |
| `TOKEN_ENCRYPTION_KEY` | Server only; used for encrypting sensitive tokens at rest where applicable |
| `RESEND_API_KEY` / SMTP | Server only |
| Teacher Stripe secret + webhook signing secret | Stored per-teacher in `studio_policies` for lesson payments; **never** returned in full to the client (masked in Settings) |
| Teacher Stripe webhook | Verifies `stripe-signature` with the teacher’s webhook secret before marking invoices paid |
| Platform `HOSTED_STRIPE_SECRET_KEY` / `HOSTED_STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_PRO_MONTHLY` | Vercel/env only — CogNote Hosted Pro Checkout + portal + webhook. Prefer a restricted key. Never `NEXT_PUBLIC_*`. Distinct from teacher BYO keys. |

Export/import of studio data can include payment keys — treat export files as confidential.

### Email

- Outbound mail uses a pluggable provider (`resend` / `smtp` / `none`). Parent-facing mail should use **reply-to = teacher email** so replies don’t hit the platform inbox.
- Do not put secrets in email bodies.

### Headers & transport

- Production should run on **HTTPS** only (e.g. Vercel).
- Configure Supabase Auth **Site URL** and **Redirect URLs** for your real domains so reset/confirm links cannot be abused via open redirects to unexpected hosts.

---

## Self-hosting checklist

- [ ] Use strong, unique values for `TOKEN_ENCRYPTION_KEY` and all API keys
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- [ ] Enable HTTPS and correct Auth redirect URLs
- [ ] Review RLS on any custom migrations you add
- [ ] Rotate family portal tokens if a link may have been shared too widely
- [ ] If using Stripe, use webhook signing secrets (Dashboard for production, CLI `whsec_` for local) and never commit keys
- [ ] Restrict who can access your Supabase dashboard and Vercel/env stores

---

## What this file is not

This is an application security overview for operators and contributors, not a formal audit or compliance certification (SOC 2, HIPAA, etc.). Studios handling sensitive student/family data should follow their own privacy and retention policies.
