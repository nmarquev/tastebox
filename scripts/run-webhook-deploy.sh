#!/usr/bin/env bash

set -u

SITE_DIR="${TASTEBOX_SITE_DIR:-/home/tastebox/htdocs/tastebox.beweb.com.ar}"
LOG_DIR="$SITE_DIR/backend/logs"
LOG_FILE="$LOG_DIR/deploy-webhook.log"
LOCK_FILE="${TASTEBOX_DEPLOY_LOCK:-/tmp/tastebox-deploy.lock}"

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

echo "[$(date --iso-8601=seconds)] Webhook ${GITHUB_DELIVERY_ID:-unknown}: deploy solicitado"

exec 9>"$LOCK_FILE"
echo "[$(date --iso-8601=seconds)] Esperando turno de deploy"
flock 9

cd "$SITE_DIR"
if bash deploy.sh; then
  echo "[$(date --iso-8601=seconds)] Deploy completado"
else
  status=$?
  echo "[$(date --iso-8601=seconds)] Deploy fallido (codigo $status)"
  exit "$status"
fi
