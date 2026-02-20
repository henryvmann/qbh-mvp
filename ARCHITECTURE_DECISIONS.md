# QBH Architecture Decisions (Source of Truth)

Last updated: 2026-02-20  
Owner: Henry Mann

## Purpose
This document is the canonical record of product + architecture decisions for QBH, so new chats and new contributors can resume without re-litigating choices.

---

## Current State (Verified)
### Deployment
- Web app + API backend deployed on Vercel: `https://qbh-mvp.vercel.app/`
- Vapi is integrated for outbound calls.
- Vapi webhooks and tool calls are configured to hit Vercel (not Manus).

### Routing
- Next.js App Router is in use.
- Codebase uses `src/app/...` structure.
- Avoid duplicate route handlers: keep exactly one `route.*` per endpoint (no `route.ts` + `route.js` duplicates).

### Verified Endpoints (Vercel)
- `POST /api/vapi/start-call`
- `POST /api/vapi/webhook`
- `POST /api/vapi/propose-office-slot`
- `POST /api/vapi/get-candidate-slots`
- `POST /api/vapi/confirm-booking`

---

## Product Policy Decisions (Non-Negotiables)

### Consent → Call Behavior
Once a user grants permission to contact a medical office, the AI caller must:

1) Confirm whether an appointment is already on the office calendar.
   - If YES: capture appointment details (date/time/provider/location/requirements) and report back.
   - If NO: ask best-practice cadence / recommended follow-up timing based on office records or standard interval.

2) Proceed to scheduling in the recommended timeframe.

This is part of the core value proposition: the system verifies what’s already scheduled and determines the right next step without user guesswork.

---

## North-Star Scheduling Loop (End-State)

### Calendar-Driven Availability
The system will integrate with calendars (Google first; others later) so the AI only offers or accepts times that fit the user’s availability rules.

Core behaviors:
- Compute real free slots from calendar busy/free data.
- Apply user preferences: working hours, buffers, travel time, “no mornings,” etc.
- The agent should never “guess” times—availability comes from the availability layer.

### Auto-Book Then Confirm (Default Model)
Default model:
1) Agent books the appointment with the office using calendar-driven availability.
2) System notifies the user after booking with details.
3) User can keep or adjust.

This provides maximum “magic” and mirrors the “handled for you” product promise.

### Adjustment Loop (Reschedule)
UI must include an **Adjust** button that triggers:
1) A reschedule attempt (new call context).
2) Agent calls the office back to reschedule/cancel + book a new time based on real availability.
3) System updates the calendar and the appointment state.

---

## Tool Contract (Interfaces We Will Evolve)

These tool endpoints are the long-term interface boundary. Their internal logic will evolve (stubs → calendar-aware → fully automated).

### `get_candidate_slots`
**Purpose:** Provide office-safe candidate times that are truly available.

Input:
- `attempt_id` (number)
- `provider_id` (number)

Output (conceptual):
- `candidate_slots[]` with structured times (ISO start/end + timezone)
- human-readable options for the agent to speak

### `propose_office_slot`
**Purpose:** Office offered a specific time; system must normalize + conflict-check.

Input:
- `attempt_id`, `provider_id`
- `office_offer.raw_text`

Output (conceptual):
- `proposal_id`
- normalized datetime
- `conflict: true/false`
- if conflict: suggested alternatives

### `confirm_booking`
**Purpose:** Commit booking state and (later) write to calendar.

Input:
- `attempt_id`
- `proposal_id`

Output (conceptual):
- `booked: true`
- appointment details payload for UI

---

## MVP Scope (What We Ship First)

### MVP Goal
Demonstrate this loop reliably:
1) Provider selected (manual seed is fine)
2) Call initiated via backend
3) Webhook events received
4) Office offers time → tool round-trip happens
5) Outcome displayed (even if minimal)

### MVP Explicitly Out of Scope (For Now)
- Google Calendar OAuth + real availability
- Writing to calendar
- Full “Adjust” reschedule implementation
- Plaid ingestion (can be mocked)
- Household management
- Robust retry + edge-case handling

MVP must not block the end-state architecture; tool contracts remain stable as logic improves.

---

## Implementation Notes / Guardrails
- Keep the backend API as the system of record.
- UI should remain a thin client that renders status and triggers actions.
- Log and store webhook + tool call payloads (even before adding a full DB).
- Always keep Vapi tool URLs and webhook URL pointed to Vercel.
- Avoid drift: update this file when making policy changes.

