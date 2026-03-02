# CogNote

**Music note memorization for piano students — quizzes, flashcards, and spaced repetition.**

CogNote is an open-source web app that helps piano teachers assign and track note-reading exercises for their students. Teachers create customizable study plans, share them via unique URLs, and monitor progress through an analytics dashboard. Students — primarily children ages 5–14 — open a link and immediately start practicing. No login, no signup.

---

## Features

### For Teachers
- **Student management** — Add students, track their practice history, and see per-note accuracy breakdowns
- **Customizable plans** — Choose clef (treble/bass/both), key signature, specific notes, number of questions, and answer choices
- **Reusable templates** — Create plan templates and assign them to multiple students with one click
- **Share via URL** — Each student gets a unique practice link; copy it to clipboard and send to parents
- **Analytics dashboard** — See which notes students struggle with, session history, accuracy trends

### For Students
- **Quiz mode** — Multiple-choice note identification with immediate feedback and score tracking
- **Free practice** — Unlimited questions with no pressure, practice at your own pace
- **Flashcard mode** — Spaced repetition (SM-2 algorithm) with kid-friendly emoji ratings
- **Zero friction** — Open the link, tap "Start", begin practicing. No account needed
- **Kid-friendly UI** — Large buttons, friendly fonts, gentle feedback animations

### Music Notation
- Real staff rendering with [VexFlow](https://www.vexflow.com/) — treble and bass clefs, key signatures, accidentals, ledger lines
- Clean, large notation sized for tablet screens

---

## Spaced Repetition

The flashcard mode uses the **SM-2 algorithm** (same as Anki). Students rate each card with kid-friendly labels:

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
| Music Notation | VexFlow 5 |
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
git clone https://github.com/youruser/cognote.git
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

### Test Account

The seed data includes a pre-configured teacher account:

- **Email:** `teacher@example.com`
- **Password:** `password123`

This account comes with 3 sample students, 3 plans, and practice session history so you can explore the dashboard immediately.

### Demo Practice Links

These links work with the seeded data (no login required):

- [/practice/dev-token-emma-week1](http://localhost:3000/practice/dev-token-emma-week1) — Emma's Middle C Position plan
- [/practice/dev-token-liam-week1](http://localhost:3000/practice/dev-token-liam-week1) — Liam's Middle C Position plan
- [/practice/dev-token-sophia-week2](http://localhost:3000/practice/dev-token-sophia-week2) — Sophia's Treble Staff Lines plan

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
│   │   │   └── [id]/           # Per-student analytics
│   │   └── plans/              # Plan list, editor, detail views
│   │       ├── [id]/
│   │       └── new/
│   ├── (student)/              # Student pages (no auth)
│   │   └── practice/
│   │       └── [token]/        # Quiz, free practice, flashcard modes
│   ├── api/                    # API routes
│   │   ├── auth/               # Teacher account setup
│   │   ├── dashboard/          # Dashboard summary
│   │   ├── plans/              # Plan CRUD + assignment
│   │   ├── practice/           # Student session + attempt tracking
│   │   └── students/           # Student CRUD + analytics
│   ├── login/                  # Teacher login/signup
│   └── page.tsx                # Landing page
├── components/
│   ├── music/                  # VexFlow renderer, quiz engine, flashcards
│   ├── teacher/                # Teacher-specific components
│   └── ui/                     # Shared primitives (Button, Card, etc.)
├── lib/
│   ├── supabase/               # Client, server, and middleware helpers
│   ├── music.ts                # Note utilities, answer generation, presets
│   ├── srs.ts                  # SM-2 spaced repetition algorithm
│   └── token.ts                # AES-256-GCM token encryption
├── supabase/
│   ├── migrations/             # SQL schema migrations
│   └── seed.sql                # Test data for local development
└── notes/                      # Design docs and specs
```

---

## Database Schema

```
teachers
  ├── students (one-to-many)
  ├── plans (one-to-many)
  └── student_plans (students ↔ plans, many-to-many)
        └── practice_sessions (one-to-many)
        │     └── note_attempts (one-to-many)
        └── flashcard_progress (one-to-many, per note)
```

All teacher data is protected by **Row Level Security** — a teacher can only see their own students, plans, and analytics. Student practice endpoints use token-based access with no authentication.

Migrations live in `supabase/migrations/` and are applied with `npx supabase db reset`.

---

## API Routes

### Teacher-side (authenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/students` | List teacher's students |
| POST | `/api/students` | Create student |
| PUT | `/api/students/[id]` | Update student |
| DELETE | `/api/students/[id]` | Remove student |
| GET | `/api/students/[id]/analytics` | Student analytics |
| GET | `/api/plans` | List teacher's plans |
| POST | `/api/plans` | Create plan |
| PUT | `/api/plans/[id]` | Update plan |
| DELETE | `/api/plans/[id]` | Remove plan |
| POST | `/api/plans/[id]/assign` | Assign plan to student, get practice URL |
| GET | `/api/dashboard/summary` | Dashboard metrics |

### Student-side (token-based, no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/practice/[token]` | Resolve token → student name + plan config |
| POST | `/api/practice/[token]/session` | Start a practice session |
| POST | `/api/practice/[token]/session/[id]/attempt` | Record a note attempt |
| PUT | `/api/practice/[token]/session/[id]/complete` | Mark session complete |
| GET | `/api/practice/[token]/flashcards` | Get flashcard state |
| PUT | `/api/practice/[token]/flashcards` | Update flashcard after review |

---

## Deploying to Production

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) (free tier is sufficient) and create a new project.

### 2. Push the schema

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 3. Deploy to Vercel

Connect your GitHub repo to [Vercel](https://vercel.com) and set these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
TOKEN_ENCRYPTION_KEY=<generate a 64-char hex string>
```

---

## Contributing

1. Fork and clone the repo
2. Run `npx supabase start` (requires Docker)
3. Run `npx supabase db reset` to apply migrations and seed data
4. Copy `.env.example` to `.env.local` and fill in the local credentials
5. Run `npm run dev`
6. Full stack is running locally — no cloud accounts needed

### Adding a new migration

```bash
npx supabase migration new <description>
# Edit the generated SQL file in supabase/migrations/
npx supabase db reset  # Apply it
```

---

## License

[MIT](LICENSE)
