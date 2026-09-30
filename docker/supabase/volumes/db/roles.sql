-- Set the service-role passwords to POSTGRES_PASSWORD.
--
-- Adapted from supabase/supabase docker/volumes/db/roles.sql. The
-- supabase/postgres image creates these roles with placeholder passwords at
-- init time; this aligns them with the password the other services use to
-- connect. Runs once, on first database init.
--
-- Only roles that exist are altered: this trimmed stack has no Edge Functions
-- service, so e.g. supabase_functions_admin is absent and a hardcoded ALTER
-- would abort init.
\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER USER %I WITH PASSWORD %L', rolname, :'pgpass')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'supabase_auth_admin',
  'supabase_storage_admin',
  'supabase_functions_admin'
)
\gexec
