# Contributing to CogNote

## Local setup

1. Fork and clone the repo
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Node.js 18+
3. `npm install`
4. `npx supabase start` then `npx supabase db reset`
5. Copy `.env.example` to `.env.local` and fill in keys from `supabase start` output (plus a generated `TOKEN_ENCRYPTION_KEY`)
6. `npm run dev` → [http://localhost:3000](http://localhost:3000)

Full stack runs locally — no cloud accounts required. Details: [README.md](README.md#getting-started).

Please use **permissive-licensed dependencies only** (no GPL/AGPL) so the project stays cleanly MIT.

## Testing

```bash
npm test            # unit tests (Vitest), under a second
npm run test:watch
npm run typecheck   # tsc --noEmit
```

Unit tests live next to the code (`lib/*.test.ts`) and cover pure logic only — no database, browser, or network. Highest-value suites: timezone/DST scheduling (`lib/schedule.test.ts`), SM-2, token encryption, email composition, billing derivation, hosted entitlements. CI (`.github/workflows/ci.yml`) runs typecheck + unit tests on every push/PR.

When adding decision-heavy logic (date math, policy, money), put it in a pure function under `lib/` and test it there. Keep API routes thin.

### Playwright smoke (local)

Covers the roadmap core flows against a seeded local stack (sign in, create student, assign + copy link, practice token, family portal, attendance + note). Specs live in `e2e/`. Login and demo tokens are defined only in `supabase/seed.sql` (and mirrored in `e2e/helpers/auth.ts`) — not repeated here. That file is local-only: `supabase db push` / production deploys do **not** run it.

```bash
npx supabase start
npx supabase db reset --yes    # reload seed; --yes skips bucket prompts
# If reset ends with a Kong/Auth 502 while "Restarting containers…":
npx supabase stop && npx supabase start
npm run dev                    # http://localhost:3000
npx playwright install chromium
npm run test:e2e               # or npm run test:e2e:ui
```

Override the app URL with `PLAYWRIGHT_BASE_URL` if needed. Not wired into CI yet (needs Docker + a running Next server).

Playwright uses its own browser context — it does not reuse your logged-in Chrome session. Sign-in / create-student can pass against an existing local DB if the seed teacher still exists. Flows that hit fixed seed tokens or named seed students need a successful `db reset` (or equivalent seed data).

## Adding a migration

```bash
npx supabase migration new <description>
# Edit the generated SQL in supabase/migrations/
npx supabase db reset --yes
```

**Important:** Since May 2026, Supabase does not auto-expose new `public` tables to the Data API ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)). New tables need an explicit grant with RLS, or the app gets `permission denied` (42501):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE your_table TO anon, authenticated, service_role;
```

See `supabase/migrations/20260702010000_data_api_grants.sql`.

## Regenerating musical symbol SVGs

Symbols are Bravura glyphs in `public/symbols/` and `lib/symbol-paths.ts`:

```bash
npm install --save-dev opentype.js wawoff2
node scripts/extract-bravura-glyphs.js
```

Edit the `GLYPHS` map in `scripts/extract-bravura-glyphs.js` for SMuFL code points ([SMuFL](https://w3c.github.io/smufl/gitbook/)), then run the script.

## Docs

- [README.md](README.md) — product overview, local setup, production deploy
- [ARCHITECTURE.md](ARCHITECTURE.md) — structure, schema, APIs
- [SECURITY.md](SECURITY.md) — secrets and vulnerability reporting
