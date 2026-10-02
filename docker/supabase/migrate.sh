#!/usr/bin/env bash
#
# Apply CogNote's supabase/migrations/*.sql to the self-hosted database.
#
# Runs as a one-shot service after the database is healthy. Each migration is
# applied at most once; the filename is recorded in public.cognote_migrations,
# so re-running (or upgrading) only applies new files. This is deliberately
# simpler than the Supabase CLI, which is not available inside the DB image.
set -euo pipefail

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

psql_run() {
  psql -v ON_ERROR_STOP=1 --no-password --no-psqlrc \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

# The database can report healthy a moment before it accepts connections.
for i in $(seq 1 30); do
  if psql_run -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  echo "migrate: waiting for database ($i/30)…"
  sleep 2
done

psql_run -c '
  create table if not exists public.cognote_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  );
'

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [ "${#migrations[@]}" -eq 0 ]; then
  echo "migrate: no migrations found in $MIGRATIONS_DIR"
  exit 0
fi

for file in "${migrations[@]}"; do
  name="$(basename "$file")"
  applied="$(psql_run -tAc "select 1 from public.cognote_migrations where name = '$name'")"
  if [ "$applied" = "1" ]; then
    echo "migrate: skip $name (already applied)"
    continue
  fi
  echo "migrate: applying $name"
  # -1 wraps each file in a single transaction, so a failure rolls the whole
  # file back and it is not recorded in the ledger (no half-applied state).
  psql_run -1 -f "$file"
  psql_run -c "insert into public.cognote_migrations (name) values ('$name')"
done

echo "migrate: done"
