# CogNote

**Open-source studio management for private music teachers, with a practice and learning platform built in.**

CogNote runs a private music studio end to end: students and families, recurring lesson scheduling, attendance and make-up credits, lesson notes emailed home, and skill tracking. On top of the back office it adds what pure admin tools lack: quizzes, flashcards, and spaced repetition that students use between lessons. It is free to self-host (MIT) and is built by a working piano studio for its own daily use.

Two surfaces, one platform:

- **For teachers**: a full studio back office with CRM, schedule, attendance, billing, policies, analytics, and assessments.
- **For students and parents**: simple links. Students open a practice URL and tap Start. Parents get a single no-login portal with the schedule, practice links, notes, and invoices. No accounts and no passwords.

---

## What Sets CogNote Apart

1. **A real learning layer.** Most studio software stops at scheduling and billing. CogNote includes note identification and musical-symbol quizzes (optionally timed), free practice, and SM-2 spaced-repetition flashcards, with per-note accuracy analytics feeding back to the teacher.
2. **One link per family.** The parent portal is a single unguessable, revocable URL with the schedule, practice links, lesson notes, invoices, calendar feed, and studio info. No login required.
3. **Make-up lessons that follow your policy.** Cancellation windows, which cancellations bank a make-up credit, and credit expiry are all per-studio settings, never hardcoded rules. Make-ups link back to the cancellation that earned them, so credits are derivable and nothing double-counts.
4. **Your data stays yours.** MIT-licensed and fully self-hostable. The entire stack runs locally in Docker with no cloud accounts, and full data export is built in. Every integration (email, payments) degrades gracefully when unconfigured.
5. **Kid-friendly practice.** The student side is built for young learners: large buttons, friendly feedback, real staff notation sized for tablets, and emoji-rated flashcards.

---

## Features

### Studio Management (Teachers)

- **Students & families** — student CRM with structured guardian/family records; siblings share one family and one portal link; adding a student with email/phone (or adult-self) creates a singleton family automatically; optional “practicing since” (year or exact date)
- **Scheduling & attendance** — recurring weekly lesson slots with a weekly teacher view; tap a lesson to mark attendance (attended / teacher cancel / student cancel / no-show) and jot a note. Student cancels ask when notice was given (for billing/make-ups). Bulk mark for Attended / No-show / Teacher cancelled. Slots store local time + studio timezone, so a 4:00 PM Tuesday lesson stays 4:00 PM across DST shifts
- **Policy-driven make-ups** — make-up credits derive from attendance × your studio policy (cancellation window, which statuses earn credit, expiry); rescheduling links each make-up to the originating cancellation
- **Lesson notes home** — private + family-facing fields; "Save & Email Family" sends the family note via email and posts it to the portal
- **Notifications** — in-app bell for portal cancellations and Stripe payments; optional email receipt when an invoice is paid online (Account settings → Notifications)
- **Billing & invoices** — generate drafts from attendance × your billability policy and rates (slot → student → studio; default rate basis is per-hour); edit, send PDF by email, mark paid, export payments CSV; family portal shows invoice history
- **Payments (optional)** — manual by default (Zelle/Venmo/cash instructions); optional bring-your-own Stripe Checkout links + webhook
- **Studio settings** — studio name, lesson time blocks, cancellation/make-up policy, rates, and practice streaks under Studio; timezone, notifications, spreadsheet import, optional BYO AI, and data export/import under Account; payment provider under Billing → Payment settings; plus an "About the Studio" section shown on the portal
- **Skills & progress tracking** — rate students 1–5 across teacher-defined skill dimensions (Musicianship, Rhythm, Sight Reading, ...); radar chart of current levels, trend lines over time, attendance summary, and an optional level anchor (RCM, Faber)
- **Customizable lesson plans** — three plan types: note identification (C2–C7, both clefs), key signature identification, and musical symbols & concepts; reusable templates assigned in one click; optional organizational labels (Easy / Intermediate / Advanced / Fundamentals or custom)
- **Timed quizzes** — optional per-question time limit (5–60 seconds) on any plan
- **Assign via email or link** — assigning a lesson emails the practice link to the family (with their portal link); with no family email on file it falls back to the native share sheet / clipboard
- **Sheet music library** — upload PDF / MusicXML / MXL to a private library; search free scores (Mutopia PDF + OpenScore Lieder MXL import; OpenScore Quartets / IMSLP as links); assign to students; families view in the portal (browser PDF viewer + OpenSheetMusicDisplay)
- **Analytics dashboard** — per-note accuracy, session history, and practice trends per student
- **Calendar feeds** — .ics download and a subscribable calendar URL per family; cancelled lessons drop out automatically
- **Events & recitals** — create studio events with performers and repertoire; families RSVP on the portal; events appear on the Schedule week view; optional invite email and opt-in day-before reminder emails
- **Practice streaks (opt-in)** — Studio toggle (off by default); completed quizzes count by default; show streak/badges on the student page and portal when enabled

### Practice & Learning (Students)

- **Quiz mode** — multiple-choice note identification or symbol/concept questions with immediate feedback and score tracking
- **Free practice** — unlimited questions, no pressure, no timer
- **Flashcard mode** — spaced repetition (SM-2, same algorithm as Anki) for both notes and symbols, with kid-friendly emoji ratings
- **Zero friction** — open the link, tap "Start", begin practicing. No account needed

### Family Portal (Parents)

- **One private link per family** — practice links, assigned sheet music (view/download), upcoming lessons (parents can cancel with a note), studio events/RSVPs, notes from the teacher, invoices (pay link or payment instructions), calendar download/subscription, and studio info
- **Revocable** — teachers can rotate a family's portal link at any time
- **Parent-facing by design** — students only ever see practice pages; family details stay behind the portal token and teacher-only access

### Music Notation

- Real staff rendering with [VexFlow](https://www.vexflow.com/) — treble and bass clefs, key signatures, accidentals, ledger lines
- Clean, large notation sized for tablet screens
- **Standalone symbol SVGs** — clefs, notes, rests, dynamics, articulations, and more are rendered from pre-extracted Bravura (SMuFL) vector paths in `public/symbols/`. No runtime font loading; consistent on all devices including iOS (no "tofu" from missing Unicode music fonts)
- Built-in library of 40+ musical symbols and concepts across 7 categories

Flashcard rating details: [notes/spaced-repetition.md](notes/spaced-repetition.md). Layout, schema, and APIs: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Music Notation | VexFlow 5; OpenSheetMusicDisplay; browser PDF viewer |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + Auth + RLS) |
| Email | [Resend](https://resend.com) / SMTP / no-op |
| Hosting | Vercel (recommended) |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Docker Desktop** — required by the Supabase CLI for local Postgres, Auth, and REST

### Local setup

```bash
git clone https://github.com/andresjmorales/cognote.git
cd cognote
npm install

# First run pulls Docker images (a few minutes)
npx supabase start
npx supabase db reset

cp .env.example .env.local
```

After `npx supabase start`, copy the **Publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the **Secret** key → `SUPABASE_SERVICE_ROLE_KEY`. Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Minimal `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>
TOKEN_ENCRYPTION_KEY=<64-char hex>
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is stuck, use `npm run dev:fresh` (frees 3000–3002).

**Seed data:** `npx supabase db reset --yes` loads `supabase/seed.sql` — a local-only demo studio (families, schedule/make-ups, plans, practice + portal tokens, skills, invoices, events, streaks, sheet-music metadata). Credentials and tokens live in that file only; production `db push` does not seed. If reset prints a 502 while restarting containers, run `npx supabase stop && npx supabase start` before signing in.

**Try a lesson without a teacher account:** the landing page **Try a Lesson** button opens `/try` — same practice UI students see, no seed data required.

| Tool | URL |
|------|-----|
| App | [http://localhost:3000](http://localhost:3000) |
| Supabase Studio | [http://127.0.0.1:54323](http://127.0.0.1:54323) |
| Mailpit (email) | [http://127.0.0.1:54324](http://127.0.0.1:54324) |

Optional local email: set `EMAIL_PROVIDER=smtp` in `.env.local` (Mailpit). Secrets and vulnerability reporting: [SECURITY.md](SECURITY.md).

To wipe students/plans in a cloud project while keeping teachers: `supabase/clear-data.sql` in the SQL Editor (or `psql $DATABASE_URL -f supabase/clear-data.sql`).

---

## Deployment

A production studio needs Supabase, a public URL (custom domain recommended), email for notes/assigns/invoices, and Auth redirects. Family tuition Stripe is optional.

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) (free tier is fine) and create a project.

### 2. Push the schema

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies migrations only — not `seed.sql`.

**Automated migrations:** `.github/workflows/deploy-migrations.yml` runs `supabase db push` when `supabase/migrations/` changes on `main`. Add repo secrets:

| Secret | Where to get it |
|--------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [Account tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_ID` | Project Settings → General → Project ID |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database |

### 3. Domain + Supabase Auth redirects

Dashboard → **Authentication** → **URL Configuration**:

1. **Site URL** = your production URL (custom domain or Vercel URL)
2. **Redirect URLs** include `https://your-domain/**` (and `http://localhost:3000/**` if needed)

Needed for signup confirmation, password reset, and email change (`/auth/confirm`). Password-reset links must be opened in the same browser that requested them (PKCE).

### 4. Deploy to Vercel

Connect the GitHub repo and set:

| Variable | Required? | Notes |
|----------|-----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Cloud project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Cloud anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Cloud service_role (server only) |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32-byte hex; can reuse local or generate new |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` | Recommended | See email below |
| `CRON_SECRET` | Recommended on hosted / if using cron | Bearer token for `/api/cron/*` (Vercel Cron sends it automatically when set). Event reminders run once daily. |
| `NEXT_PUBLIC_BETA_ONLY` | Optional | `true` shows beta code + waitlist UI (redeploy after change) |
| `BETA_ACCESS_CODE` | Optional | Server-only secret when beta is on. **Never** `NEXT_PUBLIC_*` |
| `VAPID_PUBLIC_KEY` | Optional | Enables web push. Public key from `npx web-push generate-vapid-keys`. Read by the server at runtime and served to the browser on request — restart after changing, no rebuild |
| `VAPID_PRIVATE_KEY` | Optional | Server-only pair for the key above. **Never** `NEXT_PUBLIC_*` |
| `VAPID_SUBJECT` | Optional | `mailto:you@your-domain.com` — required by the Web Push spec; defaults to `mailto:noreply@example.com` |
| `PUSH_ENDPOINT_HOSTS_EXTRA` | Optional | Comma-separated extra push-service hostnames if yours is not standard (FCM, WNS, Mozilla and Apple are allowed by default) |
| `COGNOTE_DEPLOYMENT` | Official hosted only | Omit / `self_hosted` on your deploy. `hosted` only on cognote.studio for Free/Pro limits |
| `HOSTED_*` / `HOSTED_STRIPE_*` / `STRIPE_PRICE_ID_PRO_MONTHLY` | Official hosted only | Platform Hosted Pro — intentionally omitted from `.env.example` (cognote.studio only) |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute origin for cron-built links; see `.env.example` |

Use **cloud** Supabase keys on Vercel, not Docker local keys.

### 5. Email (recommended)

1. **Outbound:** [Resend](https://resend.com), verify your domain, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS=notifications@your-domain.com`. From-name / reply-to are per-teacher.
2. **Inbound (optional):** [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) catch-all → your inbox. Keep records **DNS only** (grey cloud) if the site is on Vercel.
3. **DMARC:** `TXT` at `_dmarc` with `v=DMARC1; p=none; …` is enough to start.

### 5b. Web push (optional)

Phone notifications for family cancellations, paid invoices and event RSVPs.
Generate a keypair once and set the three `VAPID_*` variables above:

```bash
npx web-push generate-vapid-keys
```

Push degrades cleanly: without the keys the Account-page control hides itself
and nothing is sent, so the variables are safe to omit. `NEXT_PUBLIC_*` is baked
in at build time, so changing the public key needs a redeploy. iOS delivers push
only to an app added to the Home Screen, on iOS 16.4 or later.

Stored push endpoints are restricted to known push services (FCM, WNS, Mozilla,
Apple) because the server POSTs to the URL a browser hands it; set
`PUSH_ENDPOINT_HOSTS_EXTRA` if your push service is not one of those.

### 6. Family tuition payments (optional)

Manual mark-paid works with zero config (Billing → Payment settings → payment instructions, plus an optional payment QR code such as PayNow, UPI, or PIX that is added to invoice PDFs and the family portal).

**Teacher BYO Stripe** (lesson invoices, not CogNote Hosted Pro subscriptions):

1. Stripe account in **live** mode
2. Developers → API keys → **Standard keys**: Secret (`sk_live_…`) + Publishable (`pk_live_…`). Do not use Restricted (`rk_…`) or test keys.
3. Billing → Payment settings → paste those keys
4. Workbench → Webhooks (or Developers → Webhooks): endpoint `https://<host>/api/webhooks/stripe/<your-teacher-id>`, event `checkout.session.completed` only
5. Paste the signing secret (`whsec_…`)

If the webhook is missing, families can still pay; mark the invoice paid manually.

Local webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe/<teacherId>`.

Platform Hosted Pro billing (restricted platform keys, separate from teacher tuition): [ARCHITECTURE.md](ARCHITECTURE.md#deployment-modes).

### Deploy with Docker

`docker-compose.example.yml` runs the whole stack on one host — CogNote plus its
own trimmed Supabase (Postgres, Auth, PostgREST, Storage and a small gateway),
with migrations applied automatically. No cloud accounts needed.

1. Copy the compose example and env template. The stack needs a few generated
   secrets; `generate-secrets.sh` prints them, ready to paste into `.env.local`:

   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp .env.example .env.local
   sh docker/supabase/generate-secrets.sh   # paste output into .env.local
   ```

2. Build and start:

   ```bash
   docker compose --env-file .env.local up -d --build
   ```

   Building the app image needs BuildKit (the Dockerfile uses `RUN --mount=type=cache`); install the `buildx` plugin or `docker compose up --build` fails with a misleading error.

   Open <http://localhost:3000> and create the teacher account. New signups are
   auto-confirmed by default (`ENABLE_EMAIL_AUTOCONFIRM=true`) so no mail server
   is needed; the first signup becomes the studio owner.

3. Reminder emails (optional): the stack ships a `cron` profile that hits
   `/api/cron/event-reminders` daily, standing in for Vercel Cron:

   ```bash
   docker compose --env-file .env.local --profile cron up -d
   ```

`--env-file` is required: Compose substitutes `${...}` build args from it, while `env_file:` only injects the container's runtime environment. Pass it to **every** compose command (`up`, `ps`, `logs`, `stop`, …) — `${VAR:?}` is interpolated at parse time, so bare `docker compose ps` fails without it. Secrets stay in `.env.local` and are never baked into image layers.

`NEXT_PUBLIC_*` values are inlined into the client bundle at **build** time — changing them needs a rebuild (`up -d --build`), not just a restart. By default the app reaches Supabase at `http://supabase.localhost:8000`: browsers resolve `*.localhost` to loopback, and the app container is given an `extra_hosts` entry for the same name. For production, point `SUPABASE_PUBLIC_URL` at a real domain that resolves from both the browser and the server. Migrations run in the one-shot `migrate` service and are tracked in `public.cognote_migrations`, so upgrading is `up -d --build`. Full variable reference and further notes live in [docker-compose.example.yml](docker-compose.example.yml).

### Backups and restore

The stack ships an opt-in `backup` profile: a container that `pg_dump`s the
database, tars the `storage-data` volume and copies `.env.local` into
`./backups` on the host, then prunes old files (`BACKUP_KEEP_DAYS`, default 14;
`BACKUP_SECRETS_KEEP_DAYS`, default 90). It runs one backup at start, then
follows `BACKUP_SCHEDULE` (5-field cron, default `0 3 * * *`) on the container
clock, which is UTC. Nothing here needs a host cron entry or a Docker socket.

```bash
docker compose --env-file .env.local --profile backup up -d
```

Run one on demand. It execs into the running container, so nothing is
recreated:

```bash
docker compose --env-file .env.local exec backup /bin/bash /backup.sh
```

**Restore drill** — rehearse it before you need it. Database:

```bash
# Bring the stack up first: `migrate` builds the app schema from
# supabase/migrations, and `auth`, `storage` and `realtime` are created by their
# own services on first boot.
docker compose --env-file .env.local up -d --wait

# Restore as `supabase_admin`: it is this stack's superuser and it owns those
# schemas. `postgres` is neither, and a restore run as `postgres` silently
# loses `auth.identities` and `storage.objects`.
#
# `session_replication_role = replica` for the session stops foreign keys being
# enforced during the load, so table order stops mattering. Without it the
# inserts collide with the keys those services installed and the rows are
# dropped.
{ echo 'SET session_replication_role = replica;'
  gunzip -c backups/db-YYYY-MM-DD.sql.gz
} | docker compose --env-file .env.local exec -T db psql -U supabase_admin -d postgres
```

**Verify with row counts, not with an error count.** This route prints a few
hundred lines, none of which change the data: the dump replays `CREATE TABLE`,
`GRANT` and `ALTER ... OWNER` for objects that already exist, and the
`_realtime`, `supabase_functions` and `supabase_migrations` schemas are not part
of this trimmed stack. Diff a table against the source instead:

```bash
docker compose --env-file .env.local exec -T db \
  psql -U supabase_admin -d postgres -c 'select count(*) from public.students'
```

Storage volume (stop `app` and `storage` first so nothing writes mid-restore):

```bash
docker run --rm -v cognote_storage-data:/v -v "$PWD/backups":/b alpine sh -c 'tar xzf /b/storage-YYYY-MM-DD.tar.gz -C /v'
```

Secrets: extract `.env.local` from `secrets-YYYY-MM-DD.tar.gz` and `chmod 600` it:

```bash
tar xzf backups/secrets-YYYY-MM-DD.tar.gz -C /tmp .env.local
chmod 600 /tmp/.env.local   # then move it into place as .env.local
```

### Migrating onto the bundled stack

Moving an existing self-hosted Supabase install onto this stack is mostly a
database job. The app is stateless, and the gateway keeps the same shape
(`/auth/v1`, `/rest/v1`, `/storage/v1` behind one published port).

```bash
# On the OLD stack: a dump and the storage files.
docker compose exec -T db pg_dump -U postgres -d postgres --no-owner | gzip > cognote.sql.gz
tar czf cognote-storage.tgz -C <old stack dir> volumes/storage

# On the NEW one: empty volumes, bring it up, restore, copy the files in.
docker compose --env-file .env.local down -v
docker compose --env-file .env.local up -d --wait
{ echo 'SET session_replication_role = replica;'
  gunzip -c cognote.sql.gz
} | docker compose --env-file .env.local exec -T db psql -U supabase_admin -d postgres

docker compose --env-file .env.local cp cognote-storage.tgz storage:/tmp/s.tgz
docker compose --env-file .env.local exec -T storage \
  sh -c 'tar xzf /tmp/s.tgz -C /var/lib/storage --strip-components=2'
```

A few things to watch out for:

- `supabase/postgres` runs its init scripts only on a first boot with an empty
  data directory, so start with `down -v`. Reuse a volume from an earlier attempt
  and every service dies on `password authentication failed for
  supabase_auth_admin` (and `authenticator`, `supabase_storage_admin`).
- `postgres` is not a superuser here. `supabase_admin` is, and it owns the
  `auth`, `storage` and `realtime` schemas. Restoring as `postgres` on a full dump
  drops `auth.identities` and `storage.objects` and still exits 0, and losing
  identities means nobody can sign in afterwards.
- Wherever a table already exists, the insert collides with the foreign keys the
  services installed, so rows are rejected one table at a time.
  `session_replication_role = replica` turns that off for the load. A `COPY` that
  aborts for any other reason also turns its data lines into SQL, so those
  failures surface as `invalid command \.` and `invalid command \N` rather than a
  clear message.
- The old layout keeps objects under `<stack>/volumes/storage/...` while the
  volume mounts at `/var/lib/storage`, hence `--strip-components=2`. Files are not
  enough on their own: the library is driven by the matching `storage.objects`
  rows, which is why the database restore has to bring them.

Carry the secrets over byte-exact: `JWT_SECRET` (otherwise everyone is signed
out) and `TOKEN_ENCRYPTION_KEY` (otherwise stored portal and practice tokens stop
decrypting), plus the anon and service-role keys signed with that same secret.

### Behind a reverse proxy

Forward the client `Host` header unchanged and set `X-Forwarded-Proto`, or set
`NEXT_PUBLIC_SITE_URL` to the public origin. The app builds absolute redirect URLs
from those; when none of them is present it trusts the request `Host` and assumes
`https`, which is wrong for a plain-HTTP deployment — the bundled stack sets
`NEXT_PUBLIC_SITE_URL` (from `APP_URL`) for exactly that reason.

### S3 protocol endpoint

Storage mounts an S3-compatible API at `/storage/v1/s3`, and upstream ships a
published demo key pair for it. CogNote does not use that endpoint, so the bundled
gateway denies the path (`docker/supabase/volumes/api/nginx.conf.template`) and the
stack requires real `S3_PROTOCOL_ACCESS_*` values instead of defaulting to the demo
pair. To use the S3 protocol, delete the deny block in the gateway template and set
the two values — the values `generate-secrets.sh` mints are fine.

### Hosted vs self-host

| | |
|--|--|
| **Hosted** | Official cognote.studio instance (`COGNOTE_DEPLOYMENT=hosted`) |
| **Self-host** | MIT, free forever — run the Docker stack above, or bring your own Vercel/Supabase/DNS/email |

---

## Docs

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Folder layout, schema, API routes, deployment modes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, tests, migrations, symbol SVGs |
| [SECURITY.md](SECURITY.md) | Secrets and vulnerability reporting |

---

## License

The code is licensed under [MIT](LICENSE).

**CogNote** and the CogNote logo are trademarks of Andres Jaime Morales. The MIT license covers the code, not the name or brand.
