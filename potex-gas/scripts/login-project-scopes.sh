#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/oauth-client.json"
  echo "Optional env: CLASP_AUTH_FILE=/path/to/.clasprc.json CLASP_REDIRECT_PORT=3939"
  exit 1
fi

CREDS_JSON="$1"
if [[ ! -f "$CREDS_JSON" ]]; then
  echo "OAuth client JSON not found: $CREDS_JSON"
  exit 2
fi

AUTH_FILE="${CLASP_AUTH_FILE:-$HOME/.clasprc.json}"
REDIRECT_PORT="${CLASP_REDIRECT_PORT:-3939}"
mkdir -p "$(dirname "$AUTH_FILE")"

cd "$(dirname "$0")/.."
echo "Starting clasp login with localhost redirect..."
echo "Auth file: $AUTH_FILE"
echo "Redirect port: $REDIRECT_PORT"
echo "If you are on a remote VPS, create an SSH tunnel first: ssh -L ${REDIRECT_PORT}:localhost:${REDIRECT_PORT} <vps>"
exec env PATH=/home/ubuntu/.hermes/node/bin:$PATH clasp -A "$AUTH_FILE" login \
  --creds "$CREDS_JSON" \
  --use-project-scopes \
  --include-clasp-scopes \
  --redirect-port "$REDIRECT_PORT"
