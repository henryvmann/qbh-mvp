#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://qbh-mvp.vercel.app}"

ATTEMPT_ID="${ATTEMPT_ID:-7}"
PROVIDER_ID="${PROVIDER_ID:-7e0a0402-73cc-417c-ac32-4e95b36e270b}"

echo "== QBH tool smoke =="
echo "BASE_URL=$BASE_URL"
echo "ATTEMPT_ID=$ATTEMPT_ID"
echo "PROVIDER_ID=$PROVIDER_ID"
echo

echo "-- propose-office-slot"
PROPOSE_RESP="$(curl -s -X POST "$BASE_URL/api/vapi/propose-office-slot" \
  -H "content-type: application/json" \
  -d "{\"attempt_id\":$ATTEMPT_ID,\"provider_id\":\"$PROVIDER_ID\",\"toolCallId\":\"smoke_propose\",\"office_offer\":{\"raw_text\":\"Feb 28 at 12:00 PM\"}}")"

echo "$PROPOSE_RESP" | cat
echo

# Extract proposal_id from the stringified result payload
PROPOSAL_ID="$(echo "$PROPOSE_RESP" | grep -oE '"proposal_id":"[^"]+"' | head -n 1 | cut -d':' -f2 | tr -d '"')"

if [[ -z "${PROPOSAL_ID:-}" ]]; then
  echo "ERROR: Could not extract proposal_id from propose-office-slot response"
  exit 1
fi

echo "Extracted proposal_id=$PROPOSAL_ID"
echo

echo "-- confirm-booking"
CONFIRM_RESP="$(curl -s -X POST "$BASE_URL/api/vapi/confirm-booking" \
  -H "content-type: application/json" \
  -d "{\"attempt_id\":$ATTEMPT_ID,\"proposal_id\":\"$PROPOSAL_ID\",\"toolCallId\":\"smoke_confirm\"}")"

echo "$CONFIRM_RESP" | cat
echo

echo "✅ Smoke test complete"
