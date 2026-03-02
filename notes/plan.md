# CogNote — Build Plan

**Created:** March 2, 2026

---

## Phase 1: Project Scaffolding
- [x] Initialize Next.js 14+ project with TypeScript, Tailwind CSS, App Router
- [x] Set up folder structure (route groups, lib/, components/, supabase/)
- [x] Create `.env.example` with placeholder values
- [x] Install core dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `vexflow`
- [x] Configure Tailwind with custom theme (kid-friendly palette, fonts)
- [x] Create shared UI primitives (Button, Card, etc.) or install shadcn/ui

## Phase 2: Database Schema & Supabase Setup
- [ ] Initialize local SupabSo ase (`npx supabase init`) — requires Docker
- [x] Write SQL migrations for all tables: teachers, students, plans, student_plans, practice_sessions, note_attempts, flashcard_progress
- [x] Write RLS policies for teacher-owned data
- [x] Create `seed.sql` with realistic test data
- [ ] Generate TypeScript types from live schema (once Supabase is running)

## Phase 3: Core Library Code
- [x] `lib/supabase/client.ts` — Browser Supabase client
- [x] `lib/supabase/server.ts` — Server-side Supabase client (with service role)
- [x] `lib/token.ts` — AES-256-GCM token encryption/decryption
- [x] `lib/srs.ts` — SM-2 spaced repetition algorithm
- [x] `lib/music.ts` — Note utilities (note names, octaves, randomization, plausible distractors)

## Phase 4: VexFlow + Quiz Engine (Isolated Components)
- [x] `components/music/StaffRenderer.tsx` — VexFlow wrapper (renders a note on a staff with clef + key sig)
- [x] `components/music/QuizEngine.tsx` — Quiz loop: display note → show choices → capture answer → feedback → next
- [x] `components/music/FlashcardEngine.tsx` — Flashcard loop with SM-2 self-assessment

## Phase 5: Student Practice Flow (Full Stack)
- [x] `app/(student)/practice/[token]/page.tsx` — Welcome screen with mode selection
- [x] API: `GET /api/practice/[token]` — Resolve token, return student + plan config
- [x] API: `POST /api/practice/[token]/session` — Start a practice session
- [x] API: `POST /api/practice/[token]/session/[id]/attempt` — Record an attempt
- [x] API: `PUT /api/practice/[token]/session/[id]/complete` — Complete a session
- [x] API: `GET /api/practice/[token]/flashcards` — Get flashcard state
- [x] API: `PUT /api/practice/[token]/flashcards/review` — Update flashcard after review

## Phase 6: Teacher Auth & Layout
- [x] Supabase Auth middleware for route protection
- [x] `app/(teacher)/layout.tsx` — Auth guard + nav
- [x] Login / signup page
- [x] Teacher profile creation on signup

## Phase 7: Teacher CRUD Pages
- [x] `app/(teacher)/dashboard/page.tsx` — Summary cards + recent activity
- [x] `app/(teacher)/students/page.tsx` — Student list + add form
- [x] `app/(teacher)/students/[id]/page.tsx` — Student detail + note accuracy + session history
- [x] `app/(teacher)/plans/page.tsx` — Plan list (templates + student-specific)
- [x] `app/(teacher)/plans/new/page.tsx` — Plan editor with note picker
- [x] `app/(teacher)/plans/[id]/page.tsx` — Plan detail view
- [x] "Send to..." flow — Assign plan → generate token → copy URL to clipboard
- [x] CRUD API routes for students, plans, assignment, dashboard summary, analytics

## Phase 8: Landing Page
- [x] `app/page.tsx` — Landing page with features + demo link

## Phase 9: Polish & Production Readiness (TODO)
- [ ] Sound effects (correct/incorrect chimes)
- [ ] Animations (confetti on completion, gentle feedback)
- [ ] Responsive design pass (iPad-first for students)
- [ ] Rate limiting on student endpoints
- [ ] Enhanced error handling & loading states
- [ ] README.md with setup instructions
- [ ] CONTRIBUTING.md

---

## Build Order Rationale

The spec recommends starting with the data model and building the quiz engine in isolation before wiring to the DB. This plan follows that advice:

1. **Scaffolding first** — get the project running with the right structure
2. **Schema second** — having real types makes everything downstream more accurate
3. **Core libs third** — token handling, SRS, and music utils are used everywhere
4. **Quiz engine fourth** — the core UX, built as a standalone component
5. **Student flow fifth** — the primary user journey, end-to-end
6. **Teacher auth sixth** — needed before teacher pages
7. **Teacher CRUD seventh** — management pages
8. **Analytics eighth** — requires data from practice sessions to be meaningful
9. **Polish last** — animations, sounds, responsive tweaks, docs
