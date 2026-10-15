#!/usr/bin/env bash
#
# Apply CogNote's supabase/migrations/*.sql to the self-hosted database.
#
# Runs as a one-shot service after the database is healthy. Each migration is
# applied at most once and recorded in supabase_migrations.schema_migrations,
# the same ledger `supabase db push` keeps. So re-running (or upgrading) only
# applies new files, and a database restored from a Supabase Cloud project
# already knows which migrations it has. Deliberately simpler than the
# Supabase CLI, which is not available inside the DB image.
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
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version    text primary key,
    statements text[],
    name       text
  );
'

# Stacks set up before this ledger recorded filenames in
# public.cognote_migrations, which the Data API exposed to the anon key.
# Carry those rows over (so nothing re-applies), then drop the old table.
psql_run -c "
  do \$\$
  begin
    if to_regclass('public.cognote_migrations') is not null then
      insert into supabase_migrations.schema_migrations (version, name)
      select split_part(name, '_', 1),
             regexp_replace(regexp_replace(name, '^[^_]*_', ''), '[.]sql\$', '')
      from public.cognote_migrations
      on conflict (version) do nothing;
      drop table public.cognote_migrations;
      raise notice 'migrate: moved the ledger to supabase_migrations.schema_migrations';
    end if;
  end
  \$\$;
"

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [ "${#migrations[@]}" -eq 0 ]; then
  echo "migrate: no migrations found in $MIGRATIONS_DIR"
  exit 0
fi

for file in "${migrations[@]}"; do
  base="$(basename "$file" .sql)"
  # 20260716220000_m3_workspace -> version 20260716220000, name m3_workspace
  version="${base%%_*}"
  name="${base#*_}"
  applied="$(psql_run -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")"
  if [ "$applied" = "1" ]; then
    echo "migrate: skip $base (already applied)"
    continue
  fi
  echo "migrate: applying $base"
  # -1 wraps each file in a single transaction, so a failure rolls the whole
  # file back and it is not recorded in the ledger (no half-applied state).
  psql_run -1 -f "$file"
  psql_run -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
done

echo "migrate: done"
