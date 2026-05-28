#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/oauth-client.json"
  exit 1
fi

CREDS_JSON="$1"
if [[ ! -f "$CREDS_JSON" ]]; then
  echo "OAuth client JSON not found: $CREDS_JSON"
  exit 2
fi

cd "$(dirname "$0")/.."
exec clasp login --creds "$CREDS_JSON" --use-project-scopes --include-clasp-scopes --no-localhost
