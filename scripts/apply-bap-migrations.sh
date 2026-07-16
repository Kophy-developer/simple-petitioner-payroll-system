#!/usr/bin/env bash
set -euo pipefail

# Run on the Droplet after copying migrations to /tmp/bap-migrations
# Usage: bash apply-bap-migrations.sh

ROOT="${1:-/tmp/bap-migrations}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/supabase/docker}"

cd "$COMPOSE_DIR"

if [ ! -d "$ROOT" ]; then
  echo "Migrations folder not found: $ROOT"
  exit 1
fi

echo "==> Applying migrations from $ROOT"
for f in $(ls "$ROOT"/*.sql | sort); do
  echo "---- $(basename "$f")"
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done

if [ -f /tmp/bap-seed.sql ]; then
  echo "==> Applying seed"
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /tmp/bap-seed.sql
fi

echo "==> Done"
