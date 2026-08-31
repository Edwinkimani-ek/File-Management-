#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Runs the policy and trigger tests against a throwaway Postgres.
#
# The rules that matter here — tenancy, the three roles, the fee note
# workflow — live in policies and triggers, so this exercises them where
# they actually are rather than through the interface above them. It
# needs a local Postgres 15+ and nothing else; no Supabase project is
# touched.
#
#   ./scripts/test-db.sh
#
# Override the connection with PGHOST / PGPORT / PGUSER if your Postgres
# is not the default local one.
# ---------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

DB=${TEST_DB:-wakili_test}
PSQL=(psql -v ON_ERROR_STOP=1 -q)

echo "Rebuilding $DB"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" >/dev/null
"${PSQL[@]}" -d postgres -c "create database ${DB}" >/dev/null

echo "Applying the local Supabase shim"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_local_supabase_shim.sql

echo "Applying migrations"
for file in supabase/migrations/*.sql; do
  echo "  $(basename "$file")"
  "${PSQL[@]}" -d "$DB" -f "$file"
done

echo "Running the RLS audit — it must return zero rows"
audit=$(psql -d "$DB" -t -A -F' | ' -f supabase/checks/rls_audit.sql 2>/dev/null | sed '/^$/d')
if [ -n "$audit" ]; then
  echo "RLS audit found problems:"
  echo "$audit" | sed 's/^/  /'
  exit 1
fi
echo "  clean"

echo "Running the policy tests"
psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/01_policies_test.sql 2>&1 \
  | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; /^[A-Z].*[a-z]$/p' \
  | grep -vE '^(SET|GRANT|CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|SELECT|BEGIN|COMMIT)' || true

echo
echo "Done."
