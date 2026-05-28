#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CLASP="$SCRIPT_DIR/node_modules/.bin/clasp"
PROPS_JSON="$PROJECT_ROOT/generated/phase1_script_properties.json"

if [[ ! -x "$CLASP" ]]; then
  echo "clasp not found at $CLASP"
  exit 1
fi

status_output="$($CLASP login --status 2>&1 || true)"
echo "$status_output"
if grep -qi "not logged in" <<<"$status_output"; then
  echo
  echo "Blocked: clasp is not logged in. Run one of:"
  echo "  cd $SCRIPT_DIR && ./node_modules/.bin/clasp login"
  echo "then rerun this script."
  exit 2
fi

cd "$SCRIPT_DIR"
npm run build

if [[ ! -f .clasp.json && -f dist/.clasp.json ]]; then
  echo "Found dist/.clasp.json without a root project file. Promoting it to project root..."
  cp dist/.clasp.json .clasp.json
fi

if [[ ! -f .clasp.json ]]; then
  echo "No .clasp.json found. Creating the Apps Script project..."
  "$CLASP" create --type sheets --title "Potex Automation Hub" --rootDir ./dist

  if [[ ! -f .clasp.json && -f dist/.clasp.json ]]; then
    echo "clasp wrote .clasp.json under dist/. Promoting it to project root..."
    cp dist/.clasp.json .clasp.json
  fi
fi

if [[ -f .clasp.json ]]; then
  echo ".clasp.json ready. Reusing the existing Apps Script project."
else
  echo "Failed to locate .clasp.json after project creation."
  exit 3
fi

echo "Pushing build output to Apps Script..."
npm run deploy

echo
echo "Execution API quick check:"
echo "  cd $SCRIPT_DIR && npm run exec:check"
echo "If HEAD/devMode is healthy, you can smoke-test with:"
echo "  cd $SCRIPT_DIR && npm run run:head -- validateEnvironment"
echo "  cd $SCRIPT_DIR && npm run run:head -- runPublishCustomerV2"
echo
if [[ -f "$PROPS_JSON" ]]; then
  echo "Next manual step: paste Script Properties from:"
  echo "  $PROPS_JSON"
  echo
  echo "Then run these Apps Script functions in order:"
  echo "  1. bootstrapProject()"
  echo "  2. installTriggers()"
  echo "  3. runCanonicalRefresh()"
  echo "  4. runPublishAll()"
else
  echo "Warning: Script Properties file not found: $PROPS_JSON"
fi
