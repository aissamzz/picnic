#!/usr/bin/env bash
# Docker-free local Supabase-compatible stack for development and e2e tests:
# Postgres (system binaries) + GoTrue + PostgREST + a small Node gateway that
# also serves Storage from disk. Everything lives in .local/ (gitignored).
#
#   scripts/local-stack/stack.sh setup   download binaries, create the database
#   scripts/local-stack/stack.sh start   start services, write .env.local if missing
#   scripts/local-stack/stack.sh migrate apply new migrations
#   scripts/local-stack/stack.sh stop
#   scripts/local-stack/stack.sh reset   wipe database + storage and set up again
#   scripts/local-stack/stack.sh status
#
# With Docker available, prefer `supabase start` (real Storage, Realtime, Studio).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
L="$ROOT/.local"
BIN="$L/bin"
PGDATA="$L/pg"
PGPORT="${PGPORT:-54322}"
POSTGREST_VERSION="v12.2.3"
GOTRUE_VERSION="v2.180.0"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"

AS_PG=()
[ "$(id -u)" = "0" ] && AS_PG=(runuser -u postgres --)
psql_() { "${AS_PG[@]}" psql -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

keys() {
  if [ ! -f "$L/keys.env" ]; then node "$ROOT/scripts/local-stack/keys.mjs" > "$L/keys.env"; fi
  # shellcheck disable=SC1091
  set -a; . "$L/keys.env"; set +a
}

# Runs a service in its own session, detached from this shell's pipes;
# the service writes its own pid so `stop` kills the right process.
detach() {
  local name="$1"; shift
  setsid bash -c 'echo $$ > "$0"; exec "$@"' "$L/$name.pid" "$@" > "$L/$name.log" 2>&1 < /dev/null &
  sleep 0.2
}

download() {
  mkdir -p "$BIN"
  if [ ! -x "$BIN/postgrest" ]; then
    echo "downloading PostgREST $POSTGREST_VERSION"
    curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar xJ -C "$BIN"
  fi
  if [ ! -x "$BIN/gotrue/auth" ]; then
    echo "downloading Supabase Auth $GOTRUE_VERSION"
    mkdir -p "$BIN/gotrue"
    curl -sSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" | tar xz -C "$BIN/gotrue"
  fi
}

pg_start() {
  if "${AS_PG[@]}" pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then return; fi
  "${AS_PG[@]}" pg_ctl -D "$PGDATA" -l "$L/postgres.log" -o "-p $PGPORT -k $PGDATA -c listen_addresses=127.0.0.1" -w start >/dev/null
}

gotrue_start() {
  keys
  (cd "$BIN/gotrue" && \
    GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1" \
    GOTRUE_DB_DRIVER=postgres GOTRUE_DB_NAMESPACE=auth \
    DATABASE_URL="postgres://supabase_auth_admin:auth@127.0.0.1:$PGPORT/postgres?sslmode=disable" \
    GOTRUE_SITE_URL="http://localhost:3000" GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
    GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
    GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
    GOTRUE_DISABLE_SIGNUP=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true \
    GOTRUE_EXTERNAL_PHONE_ENABLED=false GOTRUE_PASSWORD_MIN_LENGTH=8 \
    GOTRUE_MFA_TOTP_ENROLL_ENABLED=true GOTRUE_MFA_TOTP_VERIFY_ENABLED=true \
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000 GOTRUE_RATE_LIMIT_VERIFY=10000 \
    GOTRUE_LOG_LEVEL=warn \
    detach gotrue ./auth)
  for _ in $(seq 1 60); do curl -sf http://127.0.0.1:9999/health >/dev/null && return; sleep 0.5; done
  echo "GoTrue did not start, see $L/gotrue.log" >&2; exit 1
}

postgrest_start() {
  keys
  PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:$PGPORT/postgres" \
  PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
  PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=3001 PGRST_DB_POOL=10 \
  PGRST_DB_CHANNEL_ENABLED=true PGRST_LOG_LEVEL=warn \
    detach postgrest "$BIN/postgrest"
  for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3001/ && return; sleep 0.5; done
  echo "PostgREST did not start, see $L/postgrest.log" >&2; exit 1
}

gateway_start() {
  keys
  mkdir -p "$L/storage"
  STORAGE_DIR="$L/storage" JWT_SECRET="$JWT_SECRET" \
    detach gateway node "$ROOT/scripts/local-stack/gateway.mjs"
  for _ in $(seq 1 40); do curl -sf http://127.0.0.1:54321/health >/dev/null && return; sleep 0.25; done
  echo "gateway did not start, see $L/gateway.log" >&2; exit 1
}

alive() { [ -f "$L/$1.pid" ] && kill -0 "$(cat "$L/$1.pid")" 2>/dev/null; }

stop_pid() { [ -f "$L/$1.pid" ] && kill "$(cat "$L/$1.pid")" 2>/dev/null || true; rm -f "$L/$1.pid"; }

write_env() {
  keys
  if [ ! -f "$ROOT/.env.local" ]; then
    cat > "$ROOT/.env.local" <<ENV
NEXT_PUBLIC_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENABLE_DEV_UI=true
# The local stack has no Realtime server: screens poll instead.
NEXT_PUBLIC_REALTIME=off
# No API key locally: canned AI menu imports.
AI_PROVIDER=fixture
ENV
    echo "wrote .env.local"
  fi
}

cmd_setup() {
  download
  mkdir -p "$L"
  if [ ! -d "$PGDATA" ]; then
    mkdir -p "$PGDATA"
    [ "$(id -u)" = "0" ] && chown postgres "$PGDATA" "$L" && chmod 755 "$L"
    "${AS_PG[@]}" initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
    pg_start
    psql_ -f "$ROOT/supabase/tests/local/roles.sql"
    gotrue_start # runs the auth schema migrations
    psql_ -c "create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now()); revoke all on public._local_migrations from anon, authenticated;"
    cmd_migrate
    echo "seed     seed.sql"; psql_ -f "$ROOT/supabase/seed.sql"
    stop_pid gotrue
  fi
  write_env
}

# Applies migrations not yet recorded in public._local_migrations.
cmd_migrate() {
  pg_start
  psql_ -c "create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now()); revoke all on public._local_migrations from anon, authenticated;"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    name="$(basename "$f")"
    if [ -z "$(psql_ -tAc "select 1 from public._local_migrations where name = '$name'")" ]; then
      echo "migrate  $name"
      psql_ -f "$f"
      psql_ -c "insert into public._local_migrations (name) values ('$name')"
    fi
  done
  psql_ -c "notify pgrst, 'reload schema'"
}

cmd_start() {
  [ -d "$PGDATA" ] || cmd_setup
  pg_start
  alive gotrue || gotrue_start
  alive postgrest || postgrest_start
  alive gateway || gateway_start
  write_env
  echo "stack up: API http://127.0.0.1:54321  db postgres://postgres@127.0.0.1:$PGPORT/postgres"
}

cmd_stop() {
  stop_pid gateway; stop_pid postgrest; stop_pid gotrue
  # Strays from an interrupted start.
  pkill -x auth 2>/dev/null || true
  pkill -f "[.]local/bin/postgrest" 2>/dev/null || true
  pkill -f "local-stack/[g]ateway[.]mjs" 2>/dev/null || true
  "${AS_PG[@]}" pg_ctl -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  echo "stack stopped"
}

cmd_reset() {
  cmd_stop
  rm -rf "$PGDATA" "$L/storage"
  cmd_setup
}

cmd_status() {
  for s in gotrue postgrest gateway; do
    if alive "$s"; then echo "$s: up"; else echo "$s: down"; fi
  done
  "${AS_PG[@]}" pg_ctl -D "$PGDATA" status >/dev/null 2>&1 && echo "postgres: up" || echo "postgres: down"
}

case "${1:-}" in
  setup) cmd_setup ;;
  migrate) cmd_migrate ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  reset) cmd_reset ;;
  status) cmd_status ;;
  *) echo "usage: $0 setup|start|stop|reset|status" >&2; exit 1 ;;
esac
