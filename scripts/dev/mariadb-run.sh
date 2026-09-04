#!/bin/bash
# DEV/PREVIEW ONLY - runs a local MariaDB for the sandbox (production uses the Coolify MariaDB).
# Data lives in /root/mariadb-data (persistent). Binaries are re-installed by the platform after a pod
# restart, so we wait for them (or install ourselves) before starting the server.
set -u
DATADIR=/root/mariadb-data
RUNDIR=/root/mariadb-run
INIT_SQL=/app/scripts/dev/mariadb-init.sql

for i in $(seq 1 60); do
  [ -x /usr/sbin/mariadbd ] && break
  echo "[mariadb-run] waiting for mariadb binaries ($i)..."
  sleep 5
done
if [ ! -x /usr/sbin/mariadbd ]; then
  echo "[mariadb-run] installing mariadb-server via apt..."
  apt-get update -qq >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mariadb-server mariadb-client >/dev/null 2>&1
fi

mkdir -p "$DATADIR" "$RUNDIR"
if [ ! -d "$DATADIR/mysql" ]; then
  echo "[mariadb-run] initialising data directory"
  mariadb-install-db --user=root --datadir="$DATADIR" --auth-root-authentication-method=normal >/dev/null
fi

exec /usr/sbin/mariadbd \
  --user=root \
  --datadir="$DATADIR" \
  --socket="$RUNDIR/mysqld.sock" \
  --pid-file="$RUNDIR/mysqld.pid" \
  --port=3306 --bind-address=127.0.0.1 \
  --skip-name-resolve \
  --init-file="$INIT_SQL" \
  --innodb-buffer-pool-size=64M --max-connections=60 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
