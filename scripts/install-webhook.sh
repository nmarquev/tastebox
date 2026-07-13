#!/usr/bin/env bash

set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="$HOME/.config/tastebox"
ENV_FILE="$ENV_DIR/webhook.env"

command -v node >/dev/null || { echo "Falta Node.js" >&2; exit 1; }
command -v pm2 >/dev/null || { echo "Falta PM2" >&2; exit 1; }
command -v openssl >/dev/null || { echo "Falta OpenSSL" >&2; exit 1; }
command -v flock >/dev/null || { echo "Falta flock (util-linux)" >&2; exit 1; }

mkdir -p "$ENV_DIR" "$SITE_DIR/backend/logs"
chmod 700 "$ENV_DIR"

if [ ! -f "$ENV_FILE" ]; then
  secret="$(openssl rand -hex 32)"
  umask 077
  cat >"$ENV_FILE" <<EOF
GITHUB_WEBHOOK_SECRET=$secret
GITHUB_REPOSITORY=nmarquev/tastebox
DEPLOY_BRANCH=main
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=9010
TASTEBOX_SITE_DIR=$SITE_DIR
EOF
  echo "Se creo $ENV_FILE"
else
  echo "Se conserva la configuracion existente en $ENV_FILE"
fi

chmod 600 "$ENV_FILE"
chmod +x "$SITE_DIR/scripts/start-webhook.sh" "$SITE_DIR/scripts/run-webhook-deploy.sh"

if pm2 describe tastebox-webhook >/dev/null 2>&1; then
  pm2 restart tastebox-webhook --update-env
else
  pm2 start "$SITE_DIR/scripts/start-webhook.sh" --name tastebox-webhook --interpreter bash --time
fi
pm2 save

echo
echo "Webhook instalado. Configura GitHub con:"
echo "Payload URL: https://tastebox.beweb.com.ar/deploy/github"
echo "Content type: application/json"
echo "Secret: $(sed -n 's/^GITHUB_WEBHOOK_SECRET=//p' "$ENV_FILE")"
echo "Evento: Just the push event"
echo
echo "Prueba local: curl http://127.0.0.1:9010/health"

