#!/usr/bin/env bash
#
# Generate the secrets the self-hosted stack needs and print them as env lines.
# Paste the output into .env.local. Requires openssl.
#
#   sh docker/supabase/generate-secrets.sh
#
# Everything here is self-signed (HS256), matching the legacy anon/service_role
# keys that supabase-js expects. No cloud account required.
set -eu

POSTGRES_PASSWORD="$(openssl rand -hex 24)"

JWT_SECRET="$(openssl rand -hex 32)"

# S3 protocol endpoint credentials. The gateway denies that endpoint (see
# nginx.conf.template), but the compose requires these rather than defaulting to
# the demo pair Supabase publishes, so they are minted with everything else.
S3_PROTOCOL_ACCESS_KEY_ID="$(openssl rand -hex 16)"
S3_PROTOCOL_ACCESS_KEY_SECRET="$(openssl rand -hex 32)"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# jwt <role> -> a signed HS256 token for that role.
jwt() {
  local role="$1" iat exp header payload signature
  iat="$(date +%s)"
  exp="$((iat + 60 * 60 * 24 * 365 * 10))"
  header="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  payload="$(printf '{"role":"%s","iss":"cognote","iat":%s,"exp":%s}' "$role" "$iat" "$exp" | b64url)"
  signature="$(printf '%s.%s' "$header" "$payload" \
    | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  printf '%s.%s.%s' "$header" "$payload" "$signature"
}

ANON_KEY="$(jwt anon)"
SERVICE_ROLE_KEY="$(jwt service_role)"

cat <<EOF

Add these to .env.local (replace any existing values):

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
S3_PROTOCOL_ACCESS_KEY_ID=$S3_PROTOCOL_ACCESS_KEY_ID
S3_PROTOCOL_ACCESS_KEY_SECRET=$S3_PROTOCOL_ACCESS_KEY_SECRET
EOF
