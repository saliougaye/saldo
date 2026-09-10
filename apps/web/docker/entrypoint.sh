#!/bin/sh
# Applies the migrations, then starts the standalone server. The migrator is a self-contained
# bundle (see the Dockerfile) and reads its SQL from ./drizzle, so both steps run from apps/web.
set -e
cd /app/apps/web
echo "[saldo] applying migrations"
node migrate.cjs
echo "[saldo] starting server"
exec node server.js
