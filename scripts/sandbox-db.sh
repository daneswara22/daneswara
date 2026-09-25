#!/usr/bin/env bash
# Sandbox-only MariaDB bootstrap for the Emergent preview (NOT used in production).
#
# Why: in the Emergent sandbox we sit outside the Coolify network, so the production
# MariaDB hostname is unreachable. This script runs a throwaway local MariaDB so the
# preview can be explored with a small dummy dataset. In Coolify the app talks to the
# real MariaDB service and this file is never executed.
#
# What it does (idempotent, safe to restart):
#   1. reinstalls mariadb-server when the sandbox apt layer was wiped
#   2. keeps the datadir in /root (persistent) instead of /var/lib (ephemeral)
#   3. creates the database/user described by DATABASE_URL in web/.env
#   4. applies the Prisma schema and the dummy seed only when the database is empty
#
# Credentials are never hardcoded here: everything is parsed from web/.env, which is
# gitignored. Run it through supervisor:
#   [program:mariadb]
#   command=/bin/bash /app/scripts/sandbox-db.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT_DIR/web"
ENV_FILE="$WEB/.env"
DATADIR="${SANDBOX_DB_DATADIR:-/root/.sandbox-mariadb}"
SOCKET_DIR=/run/mysqld
SOCKET="$SOCKET_DIR/mysqld.sock"
LOG="${SANDBOX_DB_LOG:-/root/.sandbox-mariadb.log}"
EXPECTED_TABLES=21

log() { echo "[sandbox-db] $*"; }

# --- Read connection details from web/.env (never from the repo) --------------
if [ ! -f "$ENV_FILE" ]; then
  log "missing $ENV_FILE - create it first (see AGENTS.md)"
  exit 1
fi

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '"')"
if [ -z "${DB_URL:-}" ]; then
  log "DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

read -r DB_USER DB_PASS DB_HOST DB_NAME <<EOF_PARSE
$(python3 - "$DB_URL" <<'PY'
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1])
print(u.unquote(p.username or ''), u.unquote(p.password or ''), p.hostname or '', (p.path or '/').lstrip('/').split('?')[0])
PY
)
EOF_PARSE

case "$DB_HOST" in
  127.0.0.1|localhost) ;;
  *)
    log "DATABASE_URL points at '$DB_HOST' (remote) - nothing to bootstrap locally, exiting."
    exit 0
    ;;
esac
log "target: user=$DB_USER db=$DB_NAME host=$DB_HOST"

# --- 1) Server binary (the sandbox apt layer is ephemeral) --------------------
DEB_CACHE="${SANDBOX_DB_DEB_CACHE:-/root/.sandbox-mariadb-debs}"
if ! command -v mariadbd >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  # Another copy of this script (or a previous supervisor attempt) may already
  # hold the dpkg lock right after a pod restart; wait instead of failing.
  for _ in $(seq 1 60); do
    fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
    sleep 2
  done
  if command -v mariadbd >/dev/null 2>&1; then
    log "mariadbd appeared while waiting for dpkg lock"
  elif ls "$DEB_CACHE"/*.deb >/dev/null 2>&1; then
    # Offline path: reuse the .deb files cached on the persistent disk, so a pod
    # restart does not depend on the network being reachable.
    log "mariadbd missing - installing from cache $DEB_CACHE ..."
    dpkg -i "$DEB_CACHE"/*.deb >>"$LOG" 2>&1 || apt-get -y -qq -f install >>"$LOG" 2>&1
  fi
  if ! command -v mariadbd >/dev/null 2>&1; then
    log "mariadbd missing - installing mariadb-server from apt ..."
    apt-get update -qq >>"$LOG" 2>&1
    apt-get install -y -qq -d mariadb-server >>"$LOG" 2>&1 \
      && mkdir -p "$DEB_CACHE" \
      && cp -n /var/cache/apt/archives/*.deb "$DEB_CACHE"/ 2>/dev/null
    apt-get install -y -qq mariadb-server >>"$LOG" 2>&1
  fi
fi

mkdir -p "$SOCKET_DIR" "$DATADIR"
chown -R root:root "$DATADIR" 2>/dev/null || true

# --- 2) Datadir ---------------------------------------------------------------
if [ ! -d "$DATADIR/mysql" ]; then
  log "initialising datadir $DATADIR ..."
  mariadb-install-db --user=root --datadir="$DATADIR" >>"$LOG" 2>&1
fi

# --- 3) Start in background so we can bootstrap schema/data after it is up ----
mariadbd --user=root --datadir="$DATADIR" --bind-address=127.0.0.1 --port=3306 \
  --socket="$SOCKET" >>"$LOG" 2>&1 &
DB_PID=$!
trap 'kill -TERM "$DB_PID" 2>/dev/null' TERM INT

for _ in $(seq 1 60); do
  mysqladmin --socket="$SOCKET" ping >/dev/null 2>&1 && break
  sleep 1
done
if ! mysqladmin --socket="$SOCKET" ping >/dev/null 2>&1; then
  log "server failed to start, see $LOG"
  wait "$DB_PID"
  exit 1
fi
log "mariadb is up (pid $DB_PID)"

# --- 4) Database + app user (values come from web/.env) -----------------------
mysql --socket="$SOCKET" -uroot >>"$LOG" 2>&1 <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# --- 5) Schema + dummy data, only when empty ---------------------------------
TABLES=$(mysql --socket="$SOCKET" -uroot -N -B -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo 0)
log "tables present: $TABLES"
if [ "${TABLES:-0}" -lt "$EXPECTED_TABLES" ]; then
  log "applying prisma schema ..."
  (cd "$WEB" && npx prisma db push --skip-generate --accept-data-loss >>"$LOG" 2>&1) \
    && log "schema ok" || log "schema push FAILED (see $LOG)"
fi

USERS=$(mysql --socket="$SOCKET" -uroot -N -B -e \
  "SELECT COUNT(*) FROM \`${DB_NAME}\`.users;" 2>/dev/null || echo 0)
if [ "${USERS:-0}" -lt 1 ]; then
  log "seeding dummy dataset ..."
  (cd "$WEB" && npx tsx scripts/seed-dummy-sandbox.ts >>"$LOG" 2>&1) \
    && log "seed ok" || log "seed FAILED (see $LOG)"
fi

log "ready - serving on 127.0.0.1:3306"
wait "$DB_PID"
