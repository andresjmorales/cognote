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
| `COGNOTE_DEPLOYMENT` | Official hosted only | Omit / `self_hosted` on your deploy. `hosted` only on cognote.studio for Free/Pro limits |
| `HOSTED_*` / `HOSTED_STRIPE_*` / `STRIPE_PRICE_ID_PRO_MONTHLY` / `NEXT_PUBLIC_SITE_URL` | Official hosted only | Platform Hosted Pro — see `.env.example` |

Use **cloud** Supabase keys on Vercel, not Docker local keys.

### 5. Email (recommended)

1. **Outbound:** [Resend](https://resend.com), verify your domain, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS=notifications@your-domain.com`. From-name / reply-to are per-teacher.
2. **Inbound (optional):** [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) catch-all → your inbox. Keep records **DNS only** (grey cloud) if the site is on Vercel.
3. **DMARC:** `TXT` at `_dmarc` with `v=DMARC1; p=none; …` is enough to start.

### 6. Family tuition payments (optional)

Manual mark-paid works with zero config (Billing → Payment settings → payment instructions).

**Teacher BYO Stripe** (lesson invoices — not CogNote subscriptions):

1. Stripe account (test mode first)
2. Billing → Payment settings → paste Secret + Publishable keys
3. Webhook to `https://<host>/api/webhooks/stripe/<your-teacher-id>`, event `checkout.session.completed`
4. Paste signing secret; test with `4242…`

Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe/<teacherId>`.

Platform Hosted Pro billing: [ARCHITECTURE.md](ARCHITECTURE.md#deployment-modes).

### Hosted vs self-host

| | |
|--|--|
| **Hosted** | Official cognote.studio instance (`COGNOTE_DEPLOYMENT=hosted`) |
| **Self-host** | MIT, free forever — you run Vercel/Supabase/DNS/email yourself |

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
