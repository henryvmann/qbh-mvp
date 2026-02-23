# QBH MVP Checkpoint – Live Auto-Confirmed Booking
Date: 2026-02-22  
Owner: Henry Mann  
Environment: Production (Vercel)

---

## 🧱 Infrastructure State

### Deployment
- Production URL: https://qbh-mvp.vercel.app
- Platform: Vercel
- Framework: Next.js App Router (`src/app`)
- Backend-first architecture (UI is thin client)

### Database
- Supabase (Postgres) system-of-record
- Tables:
  - schedule_attempts
  - proposals
  - call_events
- Triggers update `updated_at`
- All scheduling state persisted

### Vapi Integration
- Outbound calls active
- Tools configured to production URLs:
  - /api/vapi/start-call
  - /api/vapi/propose-office-slot
  - /api/vapi/confirm-booking
  - /api/vapi/webhook
- Tool wrapper contract honored:

{
  "results": [
    {
      "toolCallId": "...",
      "result": "JSON string"
    }
  ]
}

- Live tool-calls wrapper parsing supported
- Production smoke-tested

---

## 🎯 Proven Scheduling Lifecycle

Live production flow confirmed:

1. start-call creates schedule_attempt
2. Outbound AI call placed
3. Office offers time
4. propose_office_slot tool invoked
5. Proposal persisted in Supabase
6. demo_autoconfirm read from DB (authoritative)
7. confirm_booking tool invoked
8. Supabase transitions:
   - proposals.status = CONFIRMED
   - schedule_attempts.status = BOOKED
9. Assistant verbally confirms booking
10. Call ends cleanly

This satisfies MVP loop defined in ARCHITECTURE_DECISIONS.md.

---

## 📊 Current State Machine

schedule_attempts.status:

- INITIATED
- CALL_STARTED
- PROPOSED
- BOOKED
- FAILED

proposals.status:

- PROPOSED
- CONFIRMED

All transitions persisted and logged.

---

## 🧠 Architectural Decisions Locked

- Backend is system-of-record
- Vapi tool layer is stable interface boundary
- Supabase holds scheduling state
- demo_autoconfirm read from DB, not tool payload
- No reliance on Vapi schema extensions for demo mode
- Production endpoints only (no localhost in tool configs)

---

## 🚫 Explicitly Out of Scope (Still)

- Calendar integration
- Real availability computation
- Reschedule loop (Adjust)
- Plaid ingestion
- Household management
- Retry logic hardening

---

## 🔐 Reproducibility Requirements

To reproduce system from scratch:

1. Clone repo
2. Install dependencies
3. Configure .env.local:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - VAPI_API_KEY
   - VAPI_ASSISTANT_ID
   - VAPI_PHONE_NUMBER_ID
4. Supabase schema SQL (see SQL editor history)
5. Vapi tool URLs must point to production domain

---

## 🏁 MVP Definition Achieved

MVP = Live end-to-end automated scheduling loop with persistent state.

Status: ✅ ACHIEVED