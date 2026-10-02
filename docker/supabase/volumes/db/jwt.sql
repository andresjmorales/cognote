-- Expose the JWT expiry to the database, matching the Auth service.
--
-- Vendored from supabase/supabase docker/volumes/db/jwt.sql. Runs once, on
-- first database init.
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
