# CogNote

**Music note memorization for piano students — quizzes, flashcards, and spaced repetition.**

CogNote is an open-source web app that helps piano teachers assign and track music exercises for their students. Teachers create customizable lesson plans — note identification drills, musical symbol quizzes, or both — share them via unique URLs, and monitor progress through an analytics dashboard. Students — primarily children ages 5–14 — open a link and immediately start practicing. No login, no signup.

---

## Features

### For Teachers
- **Student management** — Add students, track their practice history, and see per-note accuracy breakdowns
- **Customizable lesson plans** — Two plan types: note identification (clef, key signature, specific notes) and musical symbols & concepts (dynamics, tempo, articulation, note values, and more)
- **Reusable templates** — Create lesson plan templates and assign them to multiple students with one click
- **Share via URL** — Each student gets a unique practice link; copy it to clipboard and send to parents
- **Analytics dashboard** — See which notes students struggle with, session history, accuracy trends

### For Students
- **Quiz mode** — Multiple-choice note identification or symbol/concept questions with immediate feedback and score tracking
- **Free practice** — Unlimited questions with no pressure, practice at your own pace
- **Flashcard mode** — Spaced repetition (SM-2 algorithm) for both notes and symbols, with kid-friendly emoji ratings
- **Zero friction** — Open the link, tap "Start", begin practicing. No account needed
- **Kid-friendly UI** — Large buttons, friendly fonts, gentle feedback animations

### Music Notation
- Real staff rendering with [VexFlow](https://www.vexflow.com/) — treble and bass clefs, key signatures, accidentals, ledger lines
- Clean, large notation sized for tablet screens
- **Standalone symbol SVGs** — Clefs, notes, rests, dynamics, articulations, and more are rendered from pre-extracted Bravura (SMuFL) vector paths in `public/symbols/`. No runtime font loading; consistent on all devices including iOS (no “tofu” from missing Unicode music fonts).
- Built-in library of 40+ musical symbols and concepts across 7 categories

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

This account comes with 3 sample students, 3 lesson plans, and practice session history so you can explore the dashboard immediately.

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
│   │   └── plans/              # Lesson plan list, editor, detail views
│   │       ├── [id]/
│   │       └── new/
│   ├── (student)/              # Student pages (no auth)
│   │   └── practice/
│   │       └── [token]/        # Quiz, free practice, flashcard modes
│   ├── api/                    # API routes
│   │   ├── auth/               # Teacher account setup
│   │   ├── dashboard/          # Dashboard summary
│   │   ├── plans/              # Lesson plan CRUD + assignment
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
        └── flashcard_progress (one-to-many, per note or symbol)
```

All teacher data is protected by **Row Level Security** — a teacher can only see their own students, lesson plans, and analytics. Student practice endpoints use token-based access with no authentication.

Migrations live in `supabase/migrations/` and are applied with `npx supabase db reset` (local) or `npx supabase db push` (remote).

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
| GET | `/api/plans` | List teacher's lesson plans |
| POST | `/api/plans` | Create lesson plan |
| PUT | `/api/plans/[id]` | Update lesson plan |
| DELETE | `/api/plans/[id]` | Remove lesson plan |
| POST | `/api/plans/[id]/assign` | Assign lesson plan to student, get practice URL |
| GET | `/api/dashboard/summary` | Dashboard metrics |

### Student-side (token-based, no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/practice/[token]` | Resolve token → student name + plan config |
| POST | `/api/practice/[token]/session` | Start a practice session |
| POST | `/api/practice/[token]/session/[id]/attempt` | Record a note attempt |
| PUT | `/api/practice/[token]/session/[id]/complete` | Mark session complete |
| GET | `/api/practice/[token]/flashcards` | Get flashcard state (notes or symbols) |
| PUT | `/api/practice/[token]/flashcards` | Update flashcard after review (notes or symbols) |

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

### 3. Configure Supabase Auth redirects

If you use email confirmation, Supabase must know where to redirect users after they click the confirmation link:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`)
3. Add your production URL to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`)
4. To support both local and production, add both: `http://localhost:3000/**` and `https://your-app.vercel.app/**`

Without this, confirmation links will redirect to localhost.

### 4. Deploy to Vercel

Connect your GitHub repo to [Vercel](https://vercel.com) and set these environment variables:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key (click Reveal) |
| `TOKEN_ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**Important:** Use the keys from your **cloud** Supabase project, not from `.env.local` (which has local Docker keys). Only `TOKEN_ENCRYPTION_KEY` can be copied from local — or generate a new one for production.

Variables without the `NEXT_PUBLIC_` prefix (like `SUPABASE_SERVICE_ROLE_KEY`) are server-only and never exposed to the browser.

### 5. Demo link / seed data (optional)

The landing page "Try a demo" button links to `/practice/dev-token-emma-week1`, which requires seed data. Since `db push` doesn't run the seed, that link will 404 in production until you either:

- **Option A:** Run `supabase/seed.sql` manually in Supabase Dashboard → SQL Editor (may need to adjust the `auth.users` insert for cloud)
- **Option B:** Sign up in production, create a student and lesson plan, assign it, and update the landing page to use that practice URL as the demo link

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

### Regenerating musical symbol SVGs

Symbols (clefs, notes, dynamics, articulations, etc.) are rendered from Bravura glyphs extracted into `public/symbols/` and `lib/symbol-paths.ts`. To add or update symbols:

```bash
npm install --save-dev opentype.js wawoff2
node scripts/extract-bravura-glyphs.js
```

Edit the `GLYPHS` map in `scripts/extract-bravura-glyphs.js` to add SMuFL code points (see [SMuFL](https://w3c.github.io/smufl/gitbook/)), then run the script. It reads Bravura from the VexFlow package, writes SVGs to `public/symbols/`, and regenerates `lib/symbol-paths.ts`. You can then remove the dev deps if desired.

---

## License

[MIT](LICENSE)
