#!/bin/bash
# Build the Next.js static export for Capacitor iOS.
# API routes are server-side only — the native app calls Vercel directly.
# We stub them out for the static export, then restore originals after.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

STUB='import { NextResponse } from "next/server";
export const dynamic = "force-static";
export async function GET() { return NextResponse.json({ ok: false }); }
export async function POST() { return NextResponse.json({ ok: false }); }
export async function PUT() { return NextResponse.json({ ok: false }); }
export async function DELETE() { return NextResponse.json({ ok: false }); }
export async function PATCH() { return NextResponse.json({ ok: false }); }'

echo "→ Stubbing server-only routes for static export..."
while IFS= read -r -d '' f; do
  cp "$f" "$f.bak"
  echo "$STUB" > "$f"
done < <(find "$ROOT/src/app" -name "route.ts" -print0)

restore() {
  echo "→ Restoring routes..."
  find "$ROOT/src/app" -name "route.ts.bak" -print0 | while IFS= read -r -d '' bak; do
    mv "$bak" "${bak%.bak}"
  done
}
trap restore EXIT

echo "→ Building static export..."
cd "$ROOT"
CAPACITOR_BUILD=1 npx next build

echo "→ Syncing to iOS..."
npx cap sync ios

echo "✓ iOS build complete"
