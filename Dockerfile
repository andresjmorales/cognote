# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: install production + dev dependencies from the lockfile
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------------------------------------------------------------------------
# builder: compile the Next.js app.
# NEXT_PUBLIC_* vars are declared as ARGs and re-exported as ENV because Next
# inlines them into the client bundle at build time — the Docker build must
# receive them as --build-arg for the values to exist during `next build`.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1

# Compose uses ${VAR:?} fail-fast, but a bare `docker build .` with no
# --build-arg would otherwise succeed and bake an empty URL into the bundle.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
    && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    || { echo "error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY build-args are required" >&2; exit 1; }

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# runner: minimal production image.
# The standalone server runs as a dedicated non-root user (nextjs:nodejs) so a
# compromised process cannot write to the filesystem or escalate privileges.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/icon/cognote.svg').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
