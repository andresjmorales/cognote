#!/usr/bin/env bash
# Backup: DB + storage volume + env/secrets. The `backup` compose service runs
# this from a crontab (see docker-compose.example.yml); run it ad hoc with:
#   docker compose exec backup /bin/bash /backup.sh
set -euo pipefail

STAMP="$(date +%F)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
SECRETS_KEEP_DAYS="${SECRETS_KEEP_DAYS:-90}"
mkdir -p "$BACKUP_DIR"
# A run killed mid-write leaves a *.part.* file behind; clear any on exit.
trap 'rm -f "$BACKUP_DIR"/*.part.* 2>/dev/null || true' EXIT

echo "==> pg_dump"
# --no-owner so the dump restores under any superuser (ownership otherwise needs
# the exact role membership); grants are kept - the app depends on them.
# Write to a temp name and rename on success: crond ignores SIGTERM, so a
# `docker stop` can kill this mid-dump, and a truncated file under the real name
# would look complete and be kept by retention.
db="$BACKUP_DIR/db-$STAMP.sql.gz"
PGPASSWORD="${POSTGRES_PASSWORD:?}" pg_dump --no-owner -h "${DB_HOST:-db}" -U postgres -d postgres \
  | gzip > "$db.part.$$" && mv -f "$db.part.$$" "$db"

# ponytail: tar of a live dir - a file uploaded mid-tar can be half-written. Fine at one-teacher scale.
echo "==> storage"
st="$BACKUP_DIR/storage-$STAMP.tar.gz"
tar czf "$st.part.$$" -C /var/lib/storage . && mv -f "$st.part.$$" "$st"

echo "==> secrets"
if [[ -f /secrets/.env.local ]]; then
  sec="$BACKUP_DIR/secrets-$STAMP.tar.gz"
  tar czf "$sec.part.$$" -C /secrets .env.local && mv -f "$sec.part.$$" "$sec"
  chmod 600 "$sec"
fi

echo "==> retention"
find "$BACKUP_DIR" -name 'db-*.gz'      -mtime +"$KEEP_DAYS"         -delete
find "$BACKUP_DIR" -name 'storage-*.gz' -mtime +"$KEEP_DAYS"         -delete
find "$BACKUP_DIR" -name 'secrets-*.gz' -mtime +"$SECRETS_KEEP_DAYS" -delete

echo "==> done: $db"
