#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/supabase/docker}"
SECRETS_FILE="${1:-/tmp/resend-smtp.env}"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Missing secrets file: $SECRETS_FILE"
  exit 1
fi

RESEND_API_KEY=""
EMAIL_FROM=""
SMTP_SENDER_NAME="Ballot Access Pros"
SITE_URL=""

while IFS= read -r line || [ -n "$line" ]; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [ -z "$line" ] && continue
  case "$line" in
    \#*) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  case "$key" in
    RESEND_API_KEY) RESEND_API_KEY="$value" ;;
    EMAIL_FROM) EMAIL_FROM="$value" ;;
    SMTP_SENDER_NAME) SMTP_SENDER_NAME="$value" ;;
    SITE_URL) SITE_URL="$value" ;;
  esac
done < "$SECRETS_FILE"

if [ -z "$RESEND_API_KEY" ] || [[ "$RESEND_API_KEY" == PASTE_* ]]; then
  echo "Edit resend-smtp.env and put your real Resend API key in RESEND_API_KEY="
  exit 1
fi

if [ -z "$EMAIL_FROM" ] || [[ "$EMAIL_FROM" == *"YOUR_VERIFIED_DOMAIN"* ]]; then
  echo "Edit resend-smtp.env and put your real from-address in EMAIL_FROM="
  exit 1
fi

cd "$COMPOSE_DIR"

if [ ! -f .env ]; then
  echo "No .env found in $COMPOSE_DIR"
  exit 1
fi

cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"

set_kv() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" .env; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' .env > "$tmp"
    mv "$tmp" .env
  else
    printf '\n%s=%s\n' "$key" "$value" >> .env
    rm -f "$tmp"
  fi
}

set_kv SMTP_ADMIN_EMAIL "$EMAIL_FROM"
set_kv SMTP_HOST smtp.resend.com
set_kv SMTP_PORT 465
set_kv SMTP_USER resend
set_kv SMTP_PASS "$RESEND_API_KEY"
set_kv SMTP_SENDER_NAME "$SMTP_SENDER_NAME"

if [ -n "$SITE_URL" ] && [[ "$SITE_URL" != *"YOUR-APP"* ]]; then
  set_kv SITE_URL "$SITE_URL"
fi

echo "==> SMTP lines now:"
grep -E '^(SMTP_|SITE_URL=)' .env | sed 's/^SMTP_PASS=.*/SMTP_PASS=***redacted***/'

echo "==> Restarting Auth"
docker compose up -d auth

echo "==> Done. Test Forgot password or Employee ID + code on the live app."
