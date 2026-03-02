# CogNote — Product Requirements Specification

**Version:** 1.0  
**Date:** March 2, 2026  
**Author:** Andrés  
**Status:** Draft

---

## 1. Executive Summary

CogNote is a lightweight web application that helps piano teachers assign and track music note memorization exercises for their students. Teachers create customizable study plans (note sets, key signatures, clef types, quiz length), share them via unique URLs, and monitor student progress through an analytics dashboard. Students — primarily children — access their exercises through these URLs with zero authentication required.

The app draws inspiration from Duolingo's bite-sized lesson format and Anki's spaced repetition methodology, applied specifically to the domain of reading musical notation on a staff.

---

## 2. User Personas

### Teacher (Primary: Piano Teacher)
- Creates and manages student roster
- Designs study plans with specific note sets, clefs, key signatures
- Shares plans via URL (copied to clipboard → sent to parents)
- Monitors whether students practiced and which notes they struggle with
- Manages both per-student custom plans and reusable generic plan templates

### Student (Primary: Children ages 5–14)
- Receives a URL from their parent/teacher
- Opens the app and immediately starts practicing — no login, no signup
- Completes short quiz-style lessons (e.g., 10 questions)
- Can redo lessons or enter free practice mode
- Optionally uses flashcard mode for self-directed study

### Parent (Secondary)
- Receives the practice URL from the teacher
- Shares it with their child (bookmarks it, sends via text, etc.)
- No direct interaction with the app beyond forwarding the link

---

## 3. System Architecture

### 3.1 Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | SSR for student pages, API routes, familiar stack |
| Language | TypeScript | Type safety across full stack |
| Styling | Tailwind CSS | Rapid UI development, responsive |
| Music Notation | VexFlow | Industry-standard JS music notation rendering |
| Database | Supabase (PostgreSQL) | Auth, real-time, generous free tier, Row Level Security |
| Auth | Supabase Auth | Teacher login only (email/password or Google OAuth) |
| Hosting | Vercel | Seamless Next.js deployment, edge functions |
| State Management | React Context + SWR or TanStack Query | Server state caching and revalidation |

### 3.2 Supabase Overview

Supabase is an open source backend-as-a-service built on top of PostgreSQL. It provides a hosted Postgres database, a built-in authentication system (GoTrue), auto-generated REST APIs for your tables (PostgREST), Row Level Security (RLS) policies, real-time subscriptions, and a management dashboard. The entire stack is open source under Apache 2.0.

**Why Supabase over alternatives:**
- **vs. Vercel Postgres:** Vercel Postgres is just a database. Supabase bundles auth, RLS, and an ergonomic client library — all things CogNote needs.
- **vs. Prisma:** Prisma is an ORM that sits between your code and any Postgres database. Supabase's native client library and migration system handle everything Prisma would give you for a project this size, with one less abstraction layer. Prisma can be added later if desired — it works with Supabase's Postgres under the hood.
- **vs. Firebase:** Firebase is proprietary and uses a NoSQL document model. Supabase gives you a real relational database with SQL, and since it's open source, contributors can self-host the entire stack.

**How it works in your code:**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Query students for a teacher
const { data: students } = await supabase
  .from('students')
  .select('*')
  .eq('teacher_id', teacherId)
```

**Row Level Security (RLS):** RLS policies are defined at the database level and ensure that security isn't dependent on application code. For example, a policy like `teacher_id = auth.uid()` on the `students` table means that even if there's a bug in the API routes, a teacher can never accidentally see another teacher's students. Spend time learning RLS — it's one of the most powerful features you get for free.

**Free tier limits (more than sufficient for CogNote):**
- 500MB database storage
- 50,000 monthly active auth users
- 1GB file storage
- Unlimited API requests
- 2 free projects

### 3.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel (Next.js)                    │
│                                                          │
│  ┌──────────────┐    ┌───────────────────────────────┐  │
│  │  Teacher UI   │    │        Student UI              │  │
│  │  (Auth'd)     │    │   (Token-based, no auth)       │  │
│  │               │    │                                │  │
│  │  /dashboard   │    │  /practice/[token]             │  │
│  │  /students    │    │  - Quiz Mode                   │  │
│  │  /plans       │    │  - Free Practice               │  │
│  │  /plans/[id]  │    │  - Flashcard Mode              │  │
│  └──────┬───────┘    └──────────┬────────────────────┘  │
│         │                       │                        │
│  ┌──────┴───────────────────────┴────────────────────┐  │
│  │              API Routes (/api/...)                  │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────┘
                          │
                 ┌────────┴────────┐
                 │    Supabase     │
                 │  ┌───────────┐  │
                 │  │ PostgreSQL│  │
                 │  │  + Auth   │  │
                 │  └───────────┘  │
                 └─────────────────┘
```

### 3.4 Student Identity via URL Tokens

The core design decision: students are identified by a hashed token embedded in the URL, not by authentication.

**Token flow:**
1. Teacher creates/selects a student in the dashboard
2. Teacher assigns a plan to a student (or selects "Send to" on a generic plan)
3. System generates a URL: `https://cognote.app/practice/[token]`
4. Token is a URL-safe hash encoding: `studentId + planId + teacherId`
5. URL is copied to clipboard; teacher sends it to the parent
6. Student opens URL → app resolves token → loads the correct plan and ties all activity to that student

**Token generation approach:**
```
token = base64url(encrypt(JSON.stringify({ studentId, planId, teacherId })))
```

Use a symmetric encryption key (stored as env var) so tokens can be decoded server-side. This is preferable to a simple hash because you need to extract the IDs from the token. Keep tokens short enough to be shareable via text message.

**Important:** All progress data is stored server-side in Supabase, keyed to the student record. No dependency on cookies, localStorage, or session storage. If a student opens the link on a different device, their progress is still intact.

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```
teachers
  ├── students (one-to-many)
  ├── plans (one-to-many)
  │     └── plan_note_sets (one-to-many)
  └── student_plans (many-to-many: students ↔ plans)
        └── practice_sessions (one-to-many)
              └── note_attempts (one-to-many)
```

### 4.2 Table Definitions

#### `teachers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Supabase auth user ID |
| email | text | From auth |
| display_name | text | |
| created_at | timestamptz | |

#### `students`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| teacher_id | uuid (FK → teachers) | |
| name | text | First name or nickname |
| parent_contact | text | Optional — email or phone for reference |
| created_at | timestamptz | |

#### `plans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| teacher_id | uuid (FK → teachers) | |
| name | text | e.g., "Week 3 — Treble Clef Basics" |
| is_template | boolean | true = generic/reusable plan |
| clef | enum | 'treble', 'bass', 'both' |
| key_signature | text | e.g., 'C major', 'G major', 'A minor' |
| include_sharps | boolean | |
| include_flats | boolean | |
| include_chords | boolean | Future: chord identification |
| measures_shown | int | 1 or 2 measures displayed at a time |
| questions_per_lesson | int | Default 10 |
| notes | jsonb | Array of specific notes to quiz, e.g., `["C4","D4","E4","F4","G4"]` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `student_plans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| student_id | uuid (FK → students) | |
| plan_id | uuid (FK → plans) | |
| token | text (unique, indexed) | URL token for this student+plan combo |
| assigned_at | timestamptz | |
| due_date | date | Optional — when should they complete by |

#### `practice_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| student_plan_id | uuid (FK → student_plans) | |
| mode | enum | 'lesson', 'free_practice', 'flashcard' |
| started_at | timestamptz | |
| completed_at | timestamptz | Null if abandoned |
| total_correct | int | |
| total_incorrect | int | |
| total_questions | int | |

#### `note_attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| session_id | uuid (FK → practice_sessions) | |
| note_displayed | text | e.g., "E4" |
| clef | enum | 'treble' or 'bass' |
| correct_answer | text | e.g., "E" |
| student_answer | text | What they picked |
| is_correct | boolean | |
| response_time_ms | int | Optional — time to answer |
| created_at | timestamptz | |

#### `flashcard_progress` (for SRS / Anki-style mode)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| student_plan_id | uuid (FK → student_plans) | |
| note | text | e.g., "F#4" |
| clef | enum | |
| ease_factor | float | SM-2 algorithm, default 2.5 |
| interval_days | int | Days until next review |
| repetitions | int | Consecutive correct answers |
| next_review | timestamptz | |
| last_reviewed | timestamptz | |

---

## 5. Feature Specification

### 5.1 Teacher Dashboard (`/dashboard`)

**Purpose:** Landing page after login. At-a-glance view of all students and recent activity.

**Components:**
- Welcome header with teacher name
- Student activity summary cards showing:
  - Student name
  - Active plan name
  - Last practiced date (with visual indicator: green = this week, yellow = last week, red = no activity)
  - Accuracy percentage from most recent session
  - Quick link to student detail view
- "Quick Actions" area: Create New Plan, Add Student
- Weekly activity heatmap or simple bar chart (sessions per day across all students)

### 5.2 Students Page (`/students`)

**Purpose:** Manage student roster and view per-student analytics.

**Student List View:**
- Table/card list of all students
- Columns: Name, Active Plan, Last Active, Overall Accuracy, Sessions This Week
- Click to expand or navigate to student detail

**Student Detail View (`/students/[id]`):**
- Student info header (name, parent contact)
- Current assigned plan(s) with links
- **Practice Activity Timeline:** Calendar heatmap or weekly grid showing when they practiced
- **Accuracy Breakdown:** Which notes they get right vs. wrong, displayed as a visual grid
  - Color-coded note accuracy: green (>80%), yellow (50-80%), red (<50%)
  - Sorted by most missed so the teacher can see problem areas immediately
- **Session History:** List of all practice sessions with date, mode, score, duration
- **Trend Chart:** Accuracy over time (line chart, sessions on X-axis, % correct on Y-axis)

### 5.3 Plans Page (`/plans`)

**Purpose:** Create, manage, and assign study plans.

**Plan List View:**
- Two sections: "My Templates" (generic/reusable) and "Student-Specific Plans"
- Each plan card shows: name, clef, key signature, note count, assigned students (if any)
- Templates show a "Send to..." dropdown button

**"Send to" Flow (for generic templates):**
1. Teacher clicks "Send to..." on a template
2. Dropdown shows list of all students
3. Teacher selects a student
4. System creates a `student_plan` record with a unique token
5. Generated URL is automatically copied to clipboard
6. Toast notification: "Link copied! Send to [student name]'s parent."

**Plan Settings / Editor (`/plans/[id]` or `/plans/new`):**

This is the core configuration screen where the teacher defines what the student will practice.

- **Plan Name:** Text input
- **Plan Type:** Toggle — Template (reusable) vs. Student-specific
- **If student-specific:** Student selector dropdown
- **Clef Selection:** Radio — Treble / Bass / Both (alternating)
- **Key Signature:** Dropdown — C Major, G Major, D Major, F Major, Bb Major, A Minor, E Minor, D Minor, etc.
- **Accidentals:** Checkboxes — Include Sharps, Include Flats
- **Note Range:** Visual piano keyboard or staff selector where teacher can click to select/deselect specific notes. Alternatively, presets like "Middle C to G above staff" with manual override.
- **Chords (Future):** Toggle to include basic chord identification (C major triad, etc.)
- **Measures Displayed:** Radio — 1 or 2
- **Questions per Lesson:** Number input (default 10, range 5–30)
- **Answer Choices:** Number input (default 4, range 2–7)
- **Preview:** Live preview of what the student will see, rendered with VexFlow

### 5.4 Student Practice View (`/practice/[token]`)

**Purpose:** The student-facing experience. No login, no navigation chrome, just the practice tool.

#### 5.4.1 Landing / Welcome Screen
- Friendly greeting: "Hi [Student Name]! 🎵"
- Current plan name displayed
- Three mode buttons:
  - **Start Lesson** (primary, large) — begins the structured quiz
  - **Free Practice** — unlimited questions, no score tracking pressure
  - **Flashcards** — SRS-based review mode
- If they have previous sessions, show last score: "Last time: 8/10 ✨"

#### 5.4.2 Lesson Mode (Quiz)
- **Display area:** One or two measures rendered with VexFlow showing a single note on the appropriate clef with the configured key signature
- **Answer buttons:** 4 (configurable) multiple choice buttons showing note letter names (e.g., A, B, C, G)
  - One correct answer + 3 random wrong answers from the plan's note set
  - Wrong answers should be plausible (nearby notes, not wildly different)
- **Progress indicator:** "Question 3 of 10" with a progress bar
- **Immediate feedback:** Correct → green flash + brief positive sound. Incorrect → red flash + show the correct answer briefly
- **Running score:** Small display showing ✓ 5 ✗ 2
- **After all questions:**
  - Score summary: "You got 8 out of 10! Great job! 🎉"
  - Contextual encouragement (different messages for different score ranges)
  - Buttons: "Redo Lesson" (same notes, re-randomized) / "Free Practice" / "Done"
- **Data captured per question:** note displayed, clef, correct answer, student answer, correctness, response time

#### 5.4.3 Free Practice Mode
- Same UI as Lesson Mode but:
  - No question count limit — keeps going until student stops
  - Running tally of correct/incorrect displayed
  - "I'm Done" button always visible
  - Lighter pressure — maybe no red/green flashes, just a subtle indicator
  - Session still tracked and saved to DB

#### 5.4.4 Flashcard Mode (Anki-style SRS)
- **Display:** Note rendered on staff (same VexFlow rendering)
- **Interaction:** Student taps to "flip" the card, revealing the note name
- **Self-assessment buttons:** "Easy" / "Good" / "Hard" / "Again"
  - Maps to SM-2 spaced repetition algorithm adjustments
  - Controls when that note appears again
- **Session flow:** Prioritizes notes due for review (`next_review <= now`), then introduces new notes
- **Visual progress:** "Cards reviewed: 12 | Due today: 3 | New: 2"
- **Data stored:** Updates `flashcard_progress` table with new ease factor, interval, next review date

### 5.5 Music Notation Rendering (VexFlow)

**Requirements:**
- Render a single staff (treble or bass clef)
- Display key signature
- Show 1-2 measures
- Place a single note (whole note recommended for clarity) at the correct position
- Support ledger lines for notes above/below the staff
- Notes with accidentals should display the sharp/flat symbol
- Clean, large rendering suitable for children (generous sizing, high contrast)
- Responsive — works on tablets and phones (most kids will use an iPad)

**Implementation notes:**
- Use VexFlow's `EasyScore` API for simplified note placement
- Render to SVG for crisp scaling
- Wrap in a responsive container that scales based on viewport
- Consider a light background color behind the staff for visual separation

---

## 6. API Routes

### Teacher-side (authenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/students` | List teacher's students |
| POST | `/api/students` | Create student |
| PUT | `/api/students/[id]` | Update student |
| DELETE | `/api/students/[id]` | Remove student |
| GET | `/api/plans` | List teacher's plans |
| POST | `/api/plans` | Create plan |
| PUT | `/api/plans/[id]` | Update plan |
| DELETE | `/api/plans/[id]` | Remove plan |
| POST | `/api/plans/[id]/assign` | Assign plan to student, generate token URL |
| GET | `/api/students/[id]/analytics` | Get student analytics data |
| GET | `/api/dashboard/summary` | Dashboard overview data |

### Student-side (token-based, no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/practice/[token]` | Resolve token → return student name, plan config |
| POST | `/api/practice/[token]/session` | Start a new practice session |
| POST | `/api/practice/[token]/session/[id]/attempt` | Record a single note attempt |
| PUT | `/api/practice/[token]/session/[id]/complete` | Mark session as completed |
| GET | `/api/practice/[token]/flashcards` | Get flashcard state (due cards, progress) |
| PUT | `/api/practice/[token]/flashcards/review` | Update flashcard after review |

---

## 7. Analytics Specification

### Per-Student Analytics (Teacher View)

**Activity metrics:**
- Total sessions (all time, this week, this month)
- Total practice time (sum of session durations)
- Days since last practice
- Current streak (consecutive days with at least one session)

**Accuracy metrics:**
- Overall accuracy (all-time, this week)
- Accuracy by note (which specific notes they struggle with)
- Accuracy by clef (if plan uses "both")
- Accuracy trend over time (per-session accuracy plotted chronologically)
- Most missed notes (top 5, sorted by error rate)

**Engagement metrics:**
- Average session length (questions answered)
- Lesson completion rate (started vs. completed)
- Mode distribution (how often they use lesson vs. free practice vs. flashcards)
- Time-of-day distribution (when do they typically practice)

### Dashboard Summary (Teacher View)

- Students who practiced this week vs. didn't
- Average accuracy across all students
- Students needing attention (low accuracy or no recent activity)

---

## 8. UI / UX Guidelines

### General Principles
- **Kid-friendly:** Large touch targets (min 48px), clear typography, bright but not garish colors
- **Minimal friction:** Student flow should be: open link → tap "Start" → practice. Maximum 2 taps to begin.
- **Responsive:** Must work well on iPad (primary student device), phone, and desktop (teacher)
- **Accessible:** High contrast, screen reader support for teacher dashboard, keyboard navigation

### Color Palette (Suggested)
- Primary: A warm, inviting blue or teal (not clinical)
- Success: Soft green
- Error: Soft red/coral (not harsh — these are kids)
- Background: Off-white or very light warm gray
- Accent: Musical gold/amber for achievements and encouragement

### Typography
- Student-facing: Rounded, friendly sans-serif (e.g., Nunito, Quicksand)
- Teacher-facing: Clean sans-serif (e.g., Inter)
- Note names in quiz answers: Large, bold, very high contrast

### Animation & Feedback
- Correct answer: Brief confetti or star burst animation + pleasant chime
- Incorrect answer: Gentle shake + soft "try again" sound
- Lesson complete: Celebration animation proportional to score
- Keep animations short (300-500ms) — don't slow down the practice flow

---

## 9. Security Considerations

- **Teacher auth:** Supabase Auth with email/password (and optional Google OAuth). All teacher routes protected by middleware.
- **Student tokens:** Encrypted (not just hashed) so they can be decoded server-side. Use AES-256-GCM with a server-side key stored as an environment variable. Tokens should be URL-safe (base64url encoding).
- **Row Level Security:** Supabase RLS policies ensure teachers can only access their own students and plans.
- **Rate limiting:** Student practice endpoints should be rate-limited to prevent abuse (e.g., max 100 attempts per minute per token).
- **Token expiration:** Consider optional expiration dates on student_plan tokens (configurable by teacher).
- **COPPA awareness:** Since students are children, the app collects minimal PII. Student records only store first name/nickname. No email, no account creation. Parent contact info is stored on the teacher's side and never exposed to the student-facing app.

---

## 10. Spaced Repetition (SM-2) Implementation

For flashcard mode, implement a simplified SM-2 algorithm:

```
After each review:
  if (rating >= 3):  // "Good" or "Easy"
    if (repetitions == 0): interval = 1 day
    elif (repetitions == 1): interval = 3 days
    else: interval = previous_interval * ease_factor
    repetitions += 1
  else:  // "Hard" or "Again"
    repetitions = 0
    interval = 1 day (show again soon)

  // Adjust ease factor
  ease_factor = max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))

  next_review = now + interval
```

Rating mapping: Again = 1, Hard = 2, Good = 4, Easy = 5

---

## 11. Future Enhancements (Post-MVP)

These are not in scope for v1 but are worth designing for:

- **Chord identification mode:** Show a chord on the staff, student identifies root + quality
- **Interval training:** Show two notes, student identifies the interval
- **Rhythm recognition:** Play or display a rhythm pattern, student identifies time values
- **Audio playback:** Play the note's sound after answering (reinforcement learning)
- **Achievement badges:** Streak badges, accuracy badges, "mastered all treble notes" etc.
- **Teacher-to-teacher plan sharing:** Public plan library
- **Multi-instrument support:** Guitar tab reading, etc.
- **PWA support:** Install as app on iPad home screen for quicker access
- **Parent notification integration:** Optional email/SMS reminders to parents if student hasn't practiced
- **Collaborative mode:** Two students can quiz each other in real-time

---

## 12. Infrastructure & Local Development

### 12.1 No Cloud Accounts Needed for Development

During local development, no Supabase account or Vercel account is required. The entire stack runs locally using the Supabase CLI, which spins up PostgreSQL, the auth server, the REST API, and the Supabase Studio dashboard — all via Docker.

A Supabase cloud account is only needed when deploying to production.

### 12.2 Local Development Setup

**Prerequisites:** Node.js 18+, Docker Desktop (required by Supabase CLI)

```bash
# 1. Clone and install
git clone https://github.com/youruser/cognote.git
cd cognote
npm install

# 2. Initialize and start local Supabase
npx supabase init          # Creates supabase/ directory (first time only)
npx supabase start         # Spins up local Postgres + Auth + API via Docker

# This outputs local credentials:
#   API URL: http://localhost:54321
#   anon key: eyJ...
#   service_role key: eyJ...
#   Studio URL: http://localhost:54323  (local dashboard)

# 3. Configure environment
cp .env.example .env.local
# .env.local is auto-populated with local Supabase credentials

# 4. Apply migrations and seed data
npx supabase db reset      # Runs all migrations + seed.sql

# 5. Start the Next.js dev server
npm run dev                # http://localhost:3000
```

### 12.3 Database Schema Management

The database schema is stored as SQL migration files in the repo under `supabase/migrations/`. This is how the schema is version-controlled and made reproducible for any contributor.

```bash
# Create a new migration
npx supabase migration new create_students_table
# Creates: supabase/migrations/20260302120000_create_students_table.sql
# Write your CREATE TABLE / ALTER TABLE SQL in this file

# Apply migrations locally
npx supabase db reset      # Drops and recreates DB, runs all migrations + seed

# Generate TypeScript types from the live schema
npx supabase gen types typescript --local > lib/supabase/types.ts
```

**Seed data:** A `supabase/seed.sql` file should be maintained with realistic test data — a sample teacher account, several students, plans, and practice sessions. This file runs automatically after migrations on `db reset`, giving every developer a consistent starting state.

### 12.4 Deploying to Production

When ready to go live:

```bash
# 1. Create a free Supabase project at https://supabase.com
#    This gives you a cloud-hosted Postgres instance

# 2. Link your local project to the cloud project
npx supabase link --project-ref your-project-ref

# 3. Push migrations to the cloud database
npx supabase db push

# 4. Deploy Next.js to Vercel
#    - Connect your GitHub repo to Vercel
#    - Set environment variables in Vercel dashboard:
#      NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
#      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
#      TOKEN_ENCRYPTION_KEY=your-generated-secret
```

Vercel and Supabase are completely separate services that communicate over HTTPS. The Next.js app on Vercel makes requests to the Supabase API just like it does locally — only the URL and keys change.

### 12.5 Environment Variables

```bash
# .env.example (committed to repo)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
TOKEN_ENCRYPTION_KEY=<generate-a-random-32-byte-hex-string>
```

The `NEXT_PUBLIC_` prefix makes variables available in client-side code (needed for the Supabase client). The `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses RLS — used only in API routes for admin operations. The `TOKEN_ENCRYPTION_KEY` is used for encrypting/decrypting student URL tokens.

### 12.6 Self-Hosting for Contributors

Because Supabase is fully open source, anyone can run CogNote without depending on Supabase's hosted service:

- **Local/Docker:** `npx supabase start` runs the full stack in Docker containers
- **Self-hosted Supabase:** Deploy Supabase to your own server using their Docker Compose setup
- **Bare Postgres:** Since the app uses standard SQL migrations, it can theoretically run against any Postgres 15+ instance — though you'd need to handle auth separately

---

## 13. Development Notes (Cursor-Specific)

Since you're building this with Cursor, some tips for structuring the project:

- **Start with the data model.** Create the Supabase schema first (you can use the Supabase dashboard or migration files). Having the real schema in place will let Cursor generate more accurate code.
- **Use a monorepo structure** — a single Next.js project with `/app/(teacher)/...` and `/app/(student)/...` route groups to cleanly separate the two experiences.
- **Feed Cursor the VexFlow docs** early. VexFlow's API is specific enough that Cursor will benefit from having the docs in context.
- **Build the quiz engine first** as an isolated component before integrating with the DB. Get the VexFlow rendering + answer selection + scoring loop working as a pure client component, then wire it up.
- **Use Supabase's generated TypeScript types** (`supabase gen types typescript`) so Cursor has full type information for all DB operations.

### Suggested Project Structure

```
cognote/
├── app/
│   ├── (teacher)/
│   │   ├── dashboard/
│   │   ├── students/
│   │   │   └── [id]/
│   │   ├── plans/
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   └── layout.tsx          # Teacher layout with nav + auth guard
│   ├── (student)/
│   │   └── practice/
│   │       └── [token]/
│   │           └── page.tsx     # Student practice view
│   ├── api/
│   │   ├── students/
│   │   ├── plans/
│   │   ├── practice/
│   │   └── dashboard/
│   ├── layout.tsx
│   └── page.tsx                 # Landing / marketing page
├── components/
│   ├── music/
│   │   ├── StaffRenderer.tsx    # VexFlow wrapper
│   │   ├── QuizEngine.tsx       # Quiz logic + UI
│   │   ├── FlashcardEngine.tsx  # SRS logic + UI
│   │   └── NoteSelector.tsx     # Plan editor note picker
│   ├── teacher/
│   │   ├── StudentCard.tsx
│   │   ├── PlanEditor.tsx
│   │   └── AnalyticsCharts.tsx
│   └── ui/                      # Shared UI primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts             # Generated from Supabase
│   ├── token.ts                 # Token encryption/decryption
│   ├── srs.ts                   # SM-2 algorithm
│   └── music.ts                 # Note utilities, randomization
├── supabase/
│   ├── migrations/              # SQL migration files
│   └── seed.sql                 # Test data for local development
├── public/
│   └── sounds/                  # Correct/incorrect audio feedback
├── .env.example                 # Template with placeholder values (committed)
├── .env.local                   # Actual local credentials (gitignored)
├── package.json
└── README.md
```

---

## 14. Open Source Considerations

### License
MIT — consistent with Spanright and permissive enough to encourage adoption and contribution.

### Repository Structure for Contributors

The repo should include everything needed to run the project locally without any cloud accounts:

- `supabase/migrations/` — All schema migrations, version-controlled
- `supabase/seed.sql` — Test data (sample teacher, students, plans, sessions)
- `.env.example` — Documents all required environment variables with placeholder values
- `README.md` — Setup instructions, architecture overview, screenshots, demo link
- `CONTRIBUTING.md` — Issue templates, PR process, code style expectations, how to add new exercise types
- `LICENSE` — MIT

### Contributor Workflow

1. Fork and clone the repo
2. Run `npx supabase start` (requires Docker)
3. Run `npx supabase db reset` to apply migrations and seed data
4. Copy `.env.example` to `.env.local` (local Supabase credentials)
5. Run `npm run dev`
6. Full stack is running locally — no cloud accounts, no API keys to provision

### Demo Instance
Deploy a public demo with a sample teacher account so prospective users and contributors can try the app without setting anything up.

### Extensibility
Design the plan configuration as a flexible JSON schema so community members can add new exercise types (rhythm, intervals, chords) without modifying the core quiz engine. The quiz engine should accept a generic "question + answer set" interface that different exercise types can implement.