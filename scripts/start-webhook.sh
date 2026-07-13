#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${WEBHOOK_ENV_FILE:-$HOME/.config/tastebox/webhook.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE. Ejecuta scripts/install-webhook.sh primero." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/github-webhook-server.mjs"

