5.2 Paste this content (exact)
# RUNBOOK — Reproduce MVP (Feb 22, 2026)

## Goal
Reproduce the live auto-confirm scheduling loop:
Voice → propose_office_slot → confirm_booking → BOOKED (Supabase)

---

## 1) Clone & install
```bash
git clone https://github.com/henryvmann/qbh-mvp.git
cd qbh-mvp
npm install
2) Local env setup (DO NOT COMMIT)

Create .env.local in repo root:

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VAPI_API_KEY=...
VAPI_ASSISTANT_ID=...
VAPI_PHONE_NUMBER_ID=...
PUBLIC_BASE_URL=http://localhost:3000

3) Start dev server
npm run dev
4) Production smoke test: propose tool wrapper (Vapi tool-calls payload)
curl -s -X POST https://qbh-mvp.vercel.app/api/vapi/propose-office-slot \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "tool-calls",
      "toolCalls": [{
        "id": "call_test123",
        "type": "function",
        "function": {
          "name": "propose_office_slot",
          "arguments": {
            "attempt_id": 1,
            "provider_id": 999,
            "office_offer": { "raw_text": "February 24th at 2:00 PM" }
          }
        }
      }]
    }
  }'

Expected:

Response JSON contains:

results[0].toolCallId == "call_test123"

results[0].result is a stringified JSON object

5) Trigger a live call (production)
curl -s -X POST https://qbh-mvp.vercel.app/api/vapi/start-call \
  -H "Content-Type: application/json" \
  -d '{
    "office_number": "+1YOUR_PHONE_NUMBER",
    "provider_id": 999,
    "patient_name": "Test Patient",
    "provider_name": "Henry Medical Group",
    "preferred_timeframe": "next two weeks",
    "demo_autoconfirm": true
  }'
6) What to say (as the medical office)

Say clearly:
"February 24th at 2 PM."

Expected agent behavior:

Calls propose_office_slot

Tool result returns next_action=CONFIRM_BOOKING

Calls confirm_booking immediately

Says: “Perfect — thank you. The patient will see you then. Have a great day.”

Ends call

7) Verify in Supabase

Tables:

schedule_attempts: newest row has status == BOOKED

proposals: newest row has status == CONFIRMED

call_events: contains proposal_created + booking_confirmed


Save.

---

## 5.3 Commit it

```bash
cd ~/qbh-mvp
git add RUNBOOK_REPRODUCE_FEB_22_2026.md
git commit -m "Add reproducibility runbook (FEB 22 2026)"
git push