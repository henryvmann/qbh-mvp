#!/usr/bin/env bash
# Build static export for Capacitor.
# API routes and auth/callback stay on Vercel — they are excluded from this build,
# then restored. The static 'out/' folder is what Capacitor ships in the native app.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "→ Stashing server-only routes..."
mv "$ROOT/src/app/api"           "$ROOT/src/app/_api_stash"
mv "$ROOT/src/app/auth"          "$ROOT/src/app/_auth_stash"

restore() {
  echo "→ Restoring server-only routes..."
  [ -d "$ROOT/src/app/_api_stash" ]  && mv "$ROOT/src/app/_api_stash"  "$ROOT/src/app/api"
  [ -d "$ROOT/src/app/_auth_stash" ] && mv "$ROOT/src/app/_auth_stash" "$ROOT/src/app/auth"
}
trap restore EXIT

echo "→ Building static export..."
CAPACITOR_BUILD=1 npm run build

echo "→ Syncing Capacitor..."
npx cap sync

echo "✓ Capacitor build complete. Run 'npx cap open ios' or 'npx cap open android' to launch."
