# CogNote

**Open-source studio management for private music teachers — with a real practice and learning platform built in.**

CogNote runs a private music studio end to end: students and families, recurring lesson scheduling, attendance and make-up credits, lesson notes emailed home, and skill/progress tracking — plus the thing pure admin tools don't have: **quizzes, flashcards, and spaced repetition** that students actually use between lessons. It's free to self-host (MIT), and built by a working piano studio for its own daily use.

Two surfaces, one platform:

- **For teachers** — a full studio back office: CRM, schedule, attendance, billing, policies, analytics, and assessments.
- **For students and parents** — zero-friction links. Students open a practice URL and tap Start; parents get a single no-login portal with the schedule, practice links, notes, and invoices. No accounts, no passwords, nothing to forget.

---

## What Sets CogNote Apart

1. **It teaches, not just administrates** — most studio software stops at scheduling and billing. CogNote ships a genuine learning layer: note identification and musical-symbol quizzes (optionally timed), free practice, and SM-2 spaced-repetition flashcards, with per-note accuracy analytics feeding back to the teacher.
2. **One link per family** — the parent portal is a single unguessable, revocable URL. Schedule, practice links, lesson notes, invoices, calendar feed, studio info — no login, ever.
3. **Make-up lessons that follow *your* policy** — cancellation windows, which cancellations bank a make-up credit, credit expiry: all per-studio settings, never hardcoded rules. Make-ups link back to the cancellation that earned them, so credits are derivable and nothing double-counts.
4. **Your data is never hostage** — MIT-licensed and fully self-hostable. The entire stack runs locally in Docker with no cloud accounts. Every integration (email, payments) degrades gracefully when unconfigured.
5. **Kid-friendly learning** — the practice side is built for young students: large buttons, friendly feedback, real staff notation sized for tablets, and emoji-rated flashcards.

---

## Features

### Studio Management (Teachers)

- **Students & families** — student CRM with structured guardian/family records; siblings share one family and one portal link; adding a student with email/phone (or adult-self) creates a singleton family automatically
- **Scheduling & attendance** — recurring weekly lesson slots with a weekly teacher view; tap a lesson to mark attendance (attended / teacher cancel / student cancel / no-show) and jot a note. Student cancels ask when notice was given (for billing/make-ups). Bulk mark for Attended / No-show / Teacher cancelled. Slots store local time + studio timezone, so a 4:00 PM Tuesday lesson stays 4:00 PM across DST shifts
- **Policy-driven make-ups** — make-up credits derive from attendance × your studio policy (cancellation window, which statuses earn credit, expiry); rescheduling links each make-up to the originating cancellation
- **Lesson notes home** — private + family-facing fields; "Save & Email Family" sends the family note via email and posts it to the portal
- **Notifications** — in-app bell for portal cancellations and Stripe payments; optional email receipt when an invoice is paid online (Settings → Notifications)
- **Billing & invoices** — generate drafts from attendance × your billability policy and rates (slot → student → studio; default rate basis is per-hour); edit, send PDF by email, mark paid, export payments CSV; family portal shows invoice history
- **Payments (optional)** — manual by default (Zelle/Venmo/cash instructions); optional bring-your-own Stripe Checkout links + webhook
- **Studio settings, not code** — studio name, timezone, lesson time blocks, cancellation/make-up policy, billing rules, payment provider, notifications, spreadsheet student import, optional BYO AI assist, data export/import, and an "About the Studio" section shown on the portal
- **Skills & progress tracking** — rate students 1–5 across teacher-defined skill dimensions (Musicianship, Rhythm, Sight Reading, ...); radar chart of current levels, trend lines over time, attendance summary, and an optional level anchor (RCM, Faber)
- **Customizable lesson plans** — three plan types: note identification (C2–C7, both clefs), key signature identification, and musical symbols & concepts; reusable templates assigned in one click
- **Timed quizzes** — optional per-question time limit (5–60 seconds) on any plan
- **Assign via email or link** — assigning a lesson emails the practice link to the family (with their portal link); with no family email on file it falls back to the native share sheet / clipboard
- **Sheet music library** — upload PDF / MusicXML / MXL to a private library; search free scores (Mutopia PDF + OpenScore Lieder MXL import; OpenScore Quartets / IMSLP as links); assign to students; families view in the portal (browser PDF viewer + OpenSheetMusicDisplay)
- **Analytics dashboard** — per-note accuracy, session history, and practice trends per student
- **Calendar feeds** — .ics download and a subscribable calendar URL per family; cancelled lessons drop out automatically

### Practice & Learning (Students)

- **Quiz mode** — multiple-choice note identification or symbol/concept questions with immediate feedback and score tracking
- **Free practice** — unlimited questions, no pressure, no timer
- **Flashcard mode** — spaced repetition (SM-2, same algorithm as Anki) for both notes and symbols, with kid-friendly emoji ratings
- **Zero friction** — open the link, tap "Start", begin practicing. No account needed

### Family Portal (Parents)

- **One private link per family** — practice links, assigned sheet music (view/download), upcoming lessons (parents can cancel with a note), notes from the teacher, invoices (pay link or payment instructions), calendar download/subscription, and studio info
- **Revocable** — teachers can rotate a family's portal link at any time
- **Parent-facing by design** — students only ever see practice pages; family details stay behind the portal token and teacher-only access

### Music Notation

- Real staff rendering with [VexFlow](https://www.vexflow.com/) — treble and bass clefs, key signatures, accidentals, ledger lines
- Clean, large notation sized for tablet screens
- **Standalone symbol SVGs** — clefs, notes, rests, dynamics, articulations, and more are rendered from pre-extracted Bravura (SMuFL) vector paths in `public/symbols/`. No runtime font loading; consistent on all devices including iOS (no "tofu" from missing Unicode music fonts)
- Built-in library of 40+ musical symbols and concepts across 7 categories

---

## Roadmap

CogNote is under active development toward a complete studio suite. Coming next (in rough order):

- **Reminders & automation** — lesson reminders, overdue-invoice nudges, practice-inactivity alerts
- **Recitals & events** — RSVP links and per-student repertoire
- **More learning tools** — ear training (interval/chord recognition), practice streaks and badges
- **AI-drafted progress reports** — optional, bring-your-own API key, off by default; the teacher always edits before sending

Billing, invoicing, and optional BYO Stripe Checkout shipped in July 2026 (Settings → Billing / Payments).
Sheet music library (private uploads, Mutopia/OpenScore discovery, assign to students, portal view/download) shipped July 2026.

---

## Spaced Repetition

The flashcard mode uses the **SM-2 algorithm** (same as Anki) and works for both note identification and symbol/concept plans. Students rate each card with kid-friendly labels:

| Button | SM-2 Rating | Effect |
|--------|------------|--------|
| 😕 No clue | 1 (Again) | Card resets, shown again this session |
| 🤔 Tricky | 2 (Hard) | Card resets, shown again this session |
| 👍 Got it! | 4 (Good) | Card graduates, next review in 1–N days |
| ⭐ Too easy! | 5 (Easy) | Card graduates, interval grows faster |

See [notes/spaced-repetition.md](notes/spaced-repetition.md) for full algorithm documentation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Music Notation | VexFlow 5 (quizzes); OpenSheetMusicDisplay (MusicXML); browser PDF viewer (scores) |
| Charts | Recharts |
| Calendar | [ics](https://www.npmjs.com/package/ics) (.ics files + subscribable feeds) |
| Email | Provider interface — [Resend](https://resend.com) in production, SMTP/Mailpit locally, no-op when unset |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + Auth + Row Level Security) |
| Hosting | Vercel (recommended) |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Docker Desktop** — required by the Supabase CLI to run PostgreSQL, Auth, and the REST API locally

### Setup

```bash
# Clone the repo
git clone https://github.com/andresjmorales/cognote.git
cd cognote

# Install dependencies
npm install

# Start local Supabase (pulls Docker images on first run — takes a few minutes)
npx supabase start

# Apply database migrations and seed with test data
npx supabase db reset

# Create your environment file
cp .env.example .env.local
```

After `npx supabase start`, you'll see output with your local credentials. Update `.env.local` with the **Publishable** key (as `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the **Secret** key (as `SUPABASE_SERVICE_ROLE_KEY`). Generate a token encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Your `.env.local` should look like:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<secret key from supabase start>
TOKEN_ENCRYPTION_KEY=<64-char hex string you generated>
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the page hangs or Next says port 3000 is already in use, a previous `next dev` is usually still running in the background (common after Cursor/terminal restarts on Windows). Use:

```bash
npm run dev:fresh
```

That frees ports 3000–3002 and starts a clean server. Or stop the old PID Next prints (`taskkill /PID <pid> /F` on Windows).

Security model, secrets, and vulnerability reporting: see [SECURITY.md](SECURITY.md).

### Seed Data (Local Development Only)

Running `npx supabase db reset` loads `supabase/seed.sql` with a test teacher account, sample students, lesson plans, and practice history so you can explore the full dashboard immediately. See `seed.sql` for credentials — these are for **local development only** and should never be used in production.

### Clearing students and plans (e.g. production reset)

To wipe all students and lesson plans (and their assignments, sessions, and progress) while keeping teachers and auth intact, run `supabase/clear-data.sql` in the [Supabase SQL Editor](https://supabase.com/dashboard) or via:

```bash
psql $DATABASE_URL -f supabase/clear-data.sql
```

After clearing, **production** is ready for a fresh start. For **local dev**, run `npx supabase db reset` to reapply migrations and seed sample data.

### Local Dev Tools

| Tool | URL |
|------|-----|
| App | [http://localhost:3000](http://localhost:3000) |
| Supabase Studio | [http://127.0.0.1:54323](http://127.0.0.1:54323) |
| Mailpit (email) | [http://127.0.0.1:54324](http://127.0.0.1:54324) |

---

## Project Structure

```
cognote/
├── app/
│   ├── (teacher)/              # Teacher pages (auth required)
│   │   ├── dashboard/          # Overview with stats and recent activity
│   │   ├── students/           # Student list + detail views
│   │   │   └── [id]/           # Per-student analytics, skills, progress
│   │   ├── families/           # Guardian/family management + portal links
│   │   ├── schedule/           # Weekly view, attendance, make-ups, notes
│   │   ├── settings/           # Studio settings + policy editor
│   │   ├── account/            # Display name, email, password
│   │   ├── billing/            # Invoice list + detail
│   │   └── lessons/            # Lesson plan list, editor, detail views
│   │       ├── [id]/
│   │       └── new/
│   ├── (student)/              # Student pages (no auth)
│   │   └── practice/
│   │       └── [token]/        # Quiz, free practice, flashcard modes
│   ├── portal/
│   │   └── [token]/            # No-login family portal (schedule, notes, invoices)
│   ├── api/                    # API routes
│   │   ├── auth/               # Signup (beta gate), waitlist, profile
│   │   ├── dashboard/          # Dashboard summary
│   │   ├── guardians/          # Family CRUD + portal token rotation
│   │   ├── lessons/            # Lesson plan CRUD + assignment
│   │   ├── portal/             # Family calendar feed (.ics)
│   │   ├── practice/           # Student session + attempt tracking
│   │   ├── schedule/           # Slots, lessons, attendance, notes
│   │   ├── billing/            # Invoice generate, send, mark-paid, CSV export
│   │   ├── webhooks/stripe/    # BYO Stripe checkout.session.completed
│   │   ├── settings/           # Studio policy settings
│   │   ├── skills/             # Skill dimension management
│   │   └── students/           # Student CRUD + analytics + skill ratings
│   ├── login/                  # Teacher login/signup/waitlist
│   ├── try/                    # Public demo lesson (no data required)
│   └── page.tsx                # Landing page
├── components/
│   ├── music/                  # VexFlow renderer, quiz engine, flashcards
│   ├── teacher/                # Teacher-specific components
│   │   ├── schedule/           # Weekly grid, lesson dialog, policy editor
│   │   ├── settings/           # Studio settings forms
│   │   └── skills/             # Radar chart, trends, assessment panel
│   └── ui/                     # Shared primitives (Button, Card, etc.)
├── lib/
│   ├── supabase/               # Client, server, and middleware helpers
│   ├── server/                 # Server-only helpers (scheduling, SMTP, skills)
│   ├── email.ts                # Email provider interface (resend | smtp | none)
│   ├── billing.ts              # Pure invoice derivation (attendance × policy × rates)
│   ├── payments.ts             # Stripe BYO Checkout + webhook verify
│   ├── schedule.ts             # Scheduling helpers + studio policy defaults
│   ├── schedule.ts             # Timezone/DST-safe scheduling + make-up credit math
│   ├── music.ts                # Note utilities, answer generation, presets
│   ├── symbol-paths.ts         # Auto-generated: Bravura SVG path data (do not edit)
│   ├── symbols.ts              # Musical symbols & concepts library
│   ├── srs.ts                  # SM-2 spaced repetition algorithm
│   └── token.ts                # AES-256-GCM token encryption
├── public/
│   └── symbols/                # Standalone SVG files (Bravura glyphs)
├── scripts/
│   └── extract-bravura-glyphs.js  # One-time: extract Bravura → SVG + lib/symbol-paths.ts
├── supabase/
│   ├── migrations/             # SQL schema migrations
│   ├── seed.sql                # Test data for local development
│   └── clear-data.sql          # Wipe students & plans (prod-safe; teachers unchanged)
└── notes/                      # Design docs and specs
```

---

## Database Schema

```
teachers
  ├── studio_policies              (per-teacher settings: timezone, cancellation
  │                                 window, make-up credit rules, studio info)
  ├── guardians (families)         (name, email, revocable portal_token)
  ├── students                     (guardian_id FK → guardians)
  │     ├── lesson_slots           (recurring weekly schedule, local time)
  │     │     └── lessons          (materialized occurrences, DST-correct)
  │     │           ├── attendance     (attended | teacher_cancel | student_cancel | no_show)
  │     │           │     └── makeup FK ← make-up lessons link to the cancellation
  │     │           └── lesson_notes   (body, shared_with_parent, emailed_at)
  │     └── skill_assessments      (rating 1–5 per dimension, timestamped)
  ├── skill_dimensions             (teacher-extensible: Musicianship, Rhythm, ...)
  ├── plans
  └── student_plans                (students ↔ plans, many-to-many)
        ├── practice_sessions
        │     └── note_attempts
        └── flashcard_progress     (per note or symbol)

waitlist                           (beta signups, no FK)
```

All teacher data is protected by **Row Level Security** — a teacher can only see their own students, families, schedule, invoices, lesson plans, and analytics. Student practice pages and the family portal use unguessable token links with no authentication; portal tokens are revocable, and students never see family or schedule details.

Migrations live in `supabase/migrations/` and are applied with `npx supabase db reset` (local) or `npx supabase db push` (remote).

**Local:** To apply new migrations (e.g. after pulling changes that add columns), run `npx supabase db reset`. This reapplies all migrations and refreshes the schema cache; it also re-runs the seed, so you'll get fresh test data. If you see errors like "Could not find column X in the schema cache", the DB is out of date — run `npx supabase db reset` (with Docker and `npx supabase start` running).

---

## API Routes

### Teacher-side (authenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/students` | List / create students |
| PUT/DELETE | `/api/students/[id]` | Update / remove student |
| GET | `/api/students/[id]/analytics` | Student analytics |
| POST | `/api/students/[id]/skills` | Record skill ratings (1–5 per dimension) |
| GET/POST | `/api/guardians` | List / create families |
| PUT/DELETE | `/api/guardians/[id]` | Update / remove family |
| POST | `/api/guardians/[id]/rotate-token` | Revoke + reissue a family's portal link |
| GET/POST | `/api/lessons` | List / create lesson plans |
| PUT/DELETE | `/api/lessons/[id]` | Update / remove lesson plan |
| POST | `/api/lessons/[id]/assign` | Assign plan to student; emails the family when an email is on file, otherwise returns the practice URL for share/copy |
| POST | `/api/schedule/slots` | Create recurring lesson slot |
| PUT/DELETE | `/api/schedule/slots/[id]` | Update / end a slot |
| POST | `/api/schedule/lessons` | Create ad-hoc or make-up lesson |
| DELETE | `/api/schedule/lessons/[id]` | Remove a lesson occurrence |
| PUT | `/api/schedule/lessons/[id]/attendance` | Mark attendance |
| PUT | `/api/schedule/lessons/[id]/note` | Save lesson note (optionally email family) |
| GET/PUT | `/api/settings/policy` | Read / update studio policy settings |
| GET/POST | `/api/skills/dimensions` | List (lazily seeding defaults) / create skill dimensions |
| PUT/DELETE | `/api/skills/dimensions/[id]` | Rename / delete a skill dimension |
| GET | `/api/dashboard/summary` | Dashboard metrics |

### Student & family (token-based, no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/practice/[token]` | Resolve token → student name + plan config |
| POST | `/api/practice/[token]/session` | Start a practice session |
| POST | `/api/practice/[token]/session/[id]/attempt` | Record a note attempt |
| PUT | `/api/practice/[token]/session/[id]/complete` | Mark session complete |
| GET/PUT | `/api/practice/[token]/flashcards` | Get / update flashcard state (notes or symbols) |
| GET | `/api/portal/[token]/calendar` | Family .ics calendar (download or subscribe) |

---

## Deploying to Production

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) (free tier is sufficient) and create a new project.

### 2. Push the schema

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies migrations only — it does **not** run `seed.sql`. Your production database will have the schema but no test data.

**Automated migrations (recommended):** After the initial setup, `.github/workflows/deploy-migrations.yml` runs `supabase db push` automatically whenever a change to `supabase/migrations/` lands on `main`. It only applies migrations not yet recorded in the remote's migration history (tracked in `supabase_migrations.schema_migrations`). Add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|--------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com](https://supabase.com/dashboard/account/tokens) → Account → Access Tokens → Generate new token |
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Project Settings → General → Project ID (the ~20-char "ref") |
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Project Settings → Database (the password you set at project creation; can be reset there) |

### 3. Configure Supabase Auth redirects

Supabase must know where to redirect users after they click links in auth emails (signup confirmation, **password reset**, and **email change** — the latter two land on `/auth/confirm`):

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`)
3. Add your production URL to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`)
4. To support both local and production, add both: `http://localhost:3000/**` and `https://your-app.vercel.app/**`

Without this, confirmation and password-reset links will redirect to localhost. Note: password reset links must be opened in the same browser the reset was requested from (PKCE flow).

### 4. Deploy to Vercel

Connect your GitHub repo to [Vercel](https://vercel.com) and set these environment variables:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key (click Reveal) |
| `TOKEN_ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `EMAIL_PROVIDER` | `resend` in production, `smtp` for local Mailpit, `none`/unset to disable email (app still works; sends are logged and skipped) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys (only needed when `EMAIL_PROVIDER=resend`) |
| `EMAIL_FROM_ADDRESS` | Optional; defaults to `notifications@cognote.studio`. Must be on a Resend-verified domain |
| `BETA_ACCESS_CODE` | Optional; when set, sign-ups require this code and everyone else can join the waitlist. Leave unset for open sign-ups (self-hosting) |

For local dev with Mailpit, set `EMAIL_PROVIDER=smtp` in `.env.local` — emails appear in the Mailpit UI ([http://127.0.0.1:54324](http://127.0.0.1:54324)). `SMTP_HOST`/`SMTP_PORT` default to `127.0.0.1:54325` (the port exposed in `supabase/config.toml`; rerun `npx supabase start` after changing it).

**Important:** Use the keys from your **cloud** Supabase project, not from `.env.local` (which has local Docker keys). Only `TOKEN_ENCRYPTION_KEY` can be copied from local — or generate a new one for production.

Variables without the `NEXT_PUBLIC_` prefix (like `SUPABASE_SERVICE_ROLE_KEY`) are server-only and never exposed to the browser.

### 4b. Production email (optional, $0)

Email degrades gracefully — with `EMAIL_PROVIDER` unset the app runs fine and just logs skipped sends. To actually deliver email (lesson notes to families, and later invoices):

1. **Outbound:** create a free [Resend](https://resend.com) account, add **your own domain**, and add the DKIM/SPF records it shows you at your DNS host. Once verified, create an API key and set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM_ADDRESS=notifications@your-domain.com`. The from-*name* and reply-to are per-teacher automatically (parents see "{Studio Name} (via CogNote)" and replies go to the teacher).
2. **Inbound (optional):** Resend only sends. A free way to *receive* mail on the same domain is [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) — point the domain's DNS at Cloudflare (free plan), enable Email Routing, and set a catch-all forward to your inbox. If your site is on Vercel, keep every Cloudflare record **DNS only** (grey cloud) — proxying on top of Vercel causes redirect loops.
3. **Recommended DNS extras:** a DMARC record (`TXT` at `_dmarc`, value `v=DMARC1; p=none; rua=mailto:dmarc@your-domain.com`) starts deliverability monitoring without affecting sends.

Any SMTP relay also works instead of Resend (`EMAIL_PROVIDER=smtp` + `SMTP_HOST`/`SMTP_PORT`), though the bundled SMTP client is minimal (no auth/TLS) — it's intended for Mailpit-style local relays, not the open internet.

### 4c. Payments (optional)

Manual payments work with **zero config** — set payment instructions in Settings → Billing, generate invoices from attendance, email PDFs, and mark paid yourself.

Stripe is optional and bring-your-own (no platform keys, no Connect fees):

1. Create a [Stripe](https://stripe.com) account (use **test mode** first)
2. Developers → API keys → copy **Secret** and **Publishable** keys into **Settings → Payments** (choose Stripe as provider)
3. Developers → Webhooks → Add endpoint using the URL shown in Settings (`https://<your-host>/api/webhooks/stripe/<your-teacher-id>`), event: `checkout.session.completed`
4. Paste the webhook **signing secret** (`whsec_…`) into Settings
5. Send a test invoice and pay with card `4242 4242 4242 4242`; when ready, switch to live keys and a live webhook

Locally you can forward webhooks with the [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhooks/stripe/<teacherId>` (use the CLI’s `whsec_` in Settings).

### 5. Try a Lesson

The landing page "Try a Lesson" button links to `/try`, a standalone practice page that works without any seed data or database records. Visitors pick a note set and get the same experience students see — Start Lesson, Free Practice, and Flashcards.

---

## Contributing

1. Fork and clone the repo
2. Run `npx supabase start` (requires Docker)
3. Run `npx supabase db reset` to apply migrations and seed data
4. Copy `.env.example` to `.env.local` and fill in the local credentials
5. Run `npm run dev`
6. Full stack is running locally — no cloud accounts needed

Please stick to **permissive-licensed dependencies only** (no GPL/AGPL) so the project stays cleanly MIT.

### Testing

```bash
npm test            # unit tests (Vitest), runs in under a second
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
```

Unit tests are colocated with the code they cover (`lib/*.test.ts`) and test pure logic only — no database, browser, or network. The highest-value suites guard the timezone/DST scheduling math (`lib/schedule.test.ts`), the SM-2 algorithm, token encryption, email composition, and quiz answer generation. CI (`.github/workflows/ci.yml`) runs the typecheck and unit tests on every push and PR.

When adding logic with real decision-making (date math, policy derivations, anything that computes money once billing lands), put it in a pure function under `lib/` and test it there — API routes should stay thin wrappers.

### Adding a new migration

```bash
npx supabase migration new <description>
# Edit the generated SQL file in supabase/migrations/
npx supabase db reset  # Apply it
```

**Important:** Since May 2026, Supabase no longer auto-exposes new `public` tables to the Data API ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)). Any migration that creates a table must include an explicit grant alongside its RLS policies, or the app will get `permission denied` (42501) errors:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE your_table TO anon, authenticated, service_role;
```

RLS policies still control which rows each role can actually touch — the grant only makes the table reachable. See `supabase/migrations/20260702010000_data_api_grants.sql`.

### Regenerating musical symbol SVGs

Symbols (clefs, notes, dynamics, articulations, etc.) are rendered from Bravura glyphs extracted into `public/symbols/` and `lib/symbol-paths.ts`. To add or update symbols:

```bash
npm install --save-dev opentype.js wawoff2
node scripts/extract-bravura-glyphs.js
```

Edit the `GLYPHS` map in `scripts/extract-bravura-glyphs.js` to add SMuFL code points (see [SMuFL](https://w3c.github.io/smufl/gitbook/)), then run the script. It reads Bravura from the VexFlow package, writes SVGs to `public/symbols/`, and regenerates `lib/symbol-paths.ts`. You can then remove the dev deps if desired.

---

## License

The code is licensed under [MIT](LICENSE).

**CogNote** and the CogNote logo are trademarks of Andres Jaime Morales. The MIT license covers the code, not the name or brand.
