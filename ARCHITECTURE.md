# CogNote Architecture

Project layout, database shape, and API surface. For setup and deploy, see [README.md](README.md). For contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Tech stack

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

## Project structure

```
cognote/
├── app/
│   ├── (teacher)/              # Teacher pages (auth required)
│   │   ├── dashboard/
│   │   ├── students/           # List + [id] detail (skills, progress, archive)
│   │   ├── families/
│   │   ├── schedule/
│   │   ├── studio/             # Studio identity, make-up policy, rates, streaks
│   │   ├── account/            # Profile (name + photo), timezone, notifications, AI, import/export (+ hosted plan when COGNOTE_DEPLOYMENT=hosted)
│   │   ├── billing/            # Invoices + Payment settings (BYO Stripe)
│   │   ├── events/
│   │   ├── music/              # Sheet music library
│   │   └── lessons/
│   ├── (student)/
│   │   └── practice/[token]/   # Quiz, free practice, flashcards
│   ├── portal/[token]/         # No-login family portal
│   ├── api/                    # See API routes below
│   ├── hosting/                # Self-host vs hosted Free / Pro
│   ├── login/
│   ├── try/                    # Public demo lesson (no DB seed required)
│   └── page.tsx                # Landing page
├── components/
│   ├── music/                  # VexFlow, quiz engine, flashcards, library UI
│   ├── teacher/                # Dashboard, schedule, settings, skills, …
│   ├── auth/                   # Login form
│   └── ui/
├── lib/
│   ├── supabase/               # Client, server, middleware, types
│   ├── server/                 # Scheduling, entitlements, SMTP, skills, …
│   ├── hosted-billing/         # Platform Stripe for CogNote Hosted Pro
│   ├── entitlements.ts         # Hosted vs self-host soft limits
│   ├── email.ts / billing.ts / payments.ts / schedule.ts / …
│   └── srs.ts                  # SM-2 spaced repetition
├── public/symbols/             # Bravura SVG glyphs
├── scripts/                    # e.g. extract-bravura-glyphs.js
├── supabase/
│   ├── migrations/
│   ├── seed.sql                # Local test data only
│   └── clear-data.sql          # Wipe students & plans (teachers kept)
└── notes/                      # Design docs (e.g. spaced-repetition.md)
```

## Database schema

```
teachers
  ├── hosted_plan / trial_ends_at / gifted_until / stripe_*   (hosted CogNote sub; ignored unless COGNOTE_DEPLOYMENT=hosted)
  ├── avatar_url                   (public Storage URL; avatars bucket)
  ├── studio_policies              (timezone, cancellation, make-ups, billing, BYO Stripe, AI, streaks, …)
  ├── guardians (families)         (name, email, revocable portal_token)
  ├── students                     (guardian_id FK; archived_at for free-tier counting)
  │     ├── lesson_slots           (recurring weekly schedule, local time + IANA tz)
  │     │     └── lessons          (materialized occurrences)
  │     │           ├── attendance     (attended | teacher_cancel | student_cancel | no_show)
  │     │           │     └── makeup FK ← make-up lessons link to the cancellation
  │     │           └── lesson_notes
  │     └── skill_assessments
  ├── skill_dimensions
  ├── plans / student_plans
  │     ├── practice_sessions → note_attempts
  │     └── flashcard_progress
  ├── invoices / invoice_items / payments
  ├── music_library_items / sheet_music_assignments
  └── events / event_performers / event_rsvps

waitlist                           (beta signups)
```

All teacher data is protected by **Row Level Security** — a teacher only sees their own rows. Student practice and the family portal use unguessable token links (no login); portal tokens are revocable. Students never see billing or family PII beyond what the portal shows parents.

Migrations live in `supabase/migrations/`.

- **Local:** `npx supabase db reset` reapplies all migrations and seed. If you see “Could not find column X in the schema cache”, reset with Docker/`supabase start` running.
- **Remote:** `npx supabase db push`, or the GitHub Action on `main` when migrations change.

## API routes

### Teacher-side (authenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/students` | List / create students |
| PUT/DELETE | `/api/students/[id]` | Update (incl. archive) / remove student |
| GET | `/api/students/[id]/analytics` | Student analytics |
| POST | `/api/students/[id]/skills` | Record skill ratings |
| GET/POST | `/api/guardians` | List / create families |
| PUT/DELETE | `/api/guardians/[id]` | Update / remove family |
| POST | `/api/guardians/[id]/rotate-token` | Revoke + reissue portal link |
| GET/POST | `/api/lessons` | List / create lesson plans |
| PUT/DELETE | `/api/lessons/[id]` | Update / remove plan |
| POST | `/api/lessons/[id]/assign` | Assign plan; email or share URL |
| POST | `/api/schedule/slots` | Create recurring slot |
| PUT/DELETE | `/api/schedule/slots/[id]` | Update / end slot |
| POST | `/api/schedule/lessons` | Ad-hoc or make-up lesson |
| DELETE | `/api/schedule/lessons/[id]` | Remove occurrence |
| PUT | `/api/schedule/lessons/[id]/attendance` | Mark attendance |
| PUT | `/api/schedule/lessons/[id]/note` | Save note (optional email) |
| GET/PUT | `/api/settings/policy` | Studio policy |
| GET/POST | `/api/skills/dimensions` | List / create skill dimensions |
| PUT/DELETE | `/api/skills/dimensions/[id]` | Rename / delete dimension |
| GET | `/api/dashboard/summary` | Dashboard metrics |
| POST | `/api/hosted-billing/checkout` | CogNote Hosted Pro Checkout (platform Stripe) |
| POST | `/api/hosted-billing/portal` | Stripe Customer Portal (cancel / payment method) |
| POST | `/api/hosted-billing/webhook` | Platform subscription webhooks |

### Student & family (token-based, no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/practice/[token]` | Resolve token → student + plan |
| POST | `/api/practice/[token]/session` | Start session |
| POST | `/api/practice/[token]/session/[id]/attempt` | Record attempt |
| PUT | `/api/practice/[token]/session/[id]/complete` | Complete session |
| GET/PUT | `/api/practice/[token]/flashcards` | Flashcard state |
| GET | `/api/portal/[token]/calendar` | Family .ics feed |

Lesson tuition Stripe (BYO per teacher) uses `/api/webhooks/stripe/[teacherId]` — separate from platform hosted billing.

## Deployment modes

| `COGNOTE_DEPLOYMENT` | Behavior |
|----------------------|----------|
| unset / `self_hosted` | Full product; no CogNote soft limits or Account hosting panel. Landing page hides “Hosting options”. |
| `hosted` | Soft limits on free plan; `/hosting` + Account hosting UI; optional platform Stripe |

`NEXT_PUBLIC_BETA_ONLY` + `BETA_ACCESS_CODE` are independent of deployment: beta UI/API vs soft limits / hosting marketing. Never put the access code in `NEXT_PUBLIC_*`.

## Spaced repetition

Flashcards use SM-2 (same algorithm as Anki). Kid-facing ratings and interval rules: [notes/spaced-repetition.md](notes/spaced-repetition.md).
