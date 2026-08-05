#!/usr/bin/env bash
set -euo pipefail

echo "Ballot Access Pros — mail env check (local shell; set vars before running)"
echo

need() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "MISSING  $name"
    return 1
  fi
  echo "OK       $name"
  return 0
}

fail=0
need RESEND_API_KEY || fail=1
need EMAIL_FROM || fail=1
if [ -n "${NEXT_PUBLIC_SITE_URL:-}" ] || [ -n "${SITE_URL:-}" ]; then
  echo "OK       NEXT_PUBLIC_SITE_URL or SITE_URL"
else
  echo "MISSING  NEXT_PUBLIC_SITE_URL or SITE_URL"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "Resend app mail looks configured."
  echo "For Auth recovery emails on the droplet, also run scripts/apply-resend-smtp-on-droplet.sh with a secrets file."
  exit 0
fi
echo "Configure missing vars on Vercel (Production) and redeploy."
exit 1
