#!/usr/bin/env bash
# Runs migrations, seed and RLS tests against a throwaway local Postgres.
# Needs Postgres binaries (initdb, pg_ctl, psql); no Docker, no Supabase CLI.
# Against a real Supabase stack use `supabase test db` instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$DATA"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() { "${RUN_AS[@]}" pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN_AS[@]}" initdb -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null

PSQL=("${RUN_AS[@]}" psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

for f in roles auth_stub pgtap_stub; do "${PSQL[@]}" -f "$ROOT/supabase/tests/local/$f.sql"; done
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "seed     seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
for f in "$ROOT"/supabase/tests/*.sql; do
  echo "test     $(basename "$f")"
  "${PSQL[@]}" -t -A -f "$f" | grep -v '^$' | sed 's/^/  /'
done
if [ -n "${GEN_TYPES:-}" ]; then
  "${PSQL[@]}" -t -A -f "$ROOT/supabase/tests/local/introspect.sql" > "$DATA/schema.json"
  node "$ROOT/scripts/gen-db-types.mjs" "$DATA/schema.json" "$GEN_TYPES"
fi
echo "all database tests passed"
