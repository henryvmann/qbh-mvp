# QBH Architecture Decisions (Source of Truth)

Last updated: 2026-02-26  
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
- Next.js App Router is in use (`src/app/...`).
- Avoid duplicate route handlers: keep exactly one `route.*` per endpoint (no `route.ts` + `route.js` duplicates).
- Prefer TypeScript route handlers for stability and consistent request parsing.

### Verified Endpoints
- `POST /api/vapi/start-call`
- `POST /api/vapi/webhook`
- `POST /api/vapi/get-candidate-slots`
- `POST /api/vapi/propose-office-slot`
- `POST /api/vapi/confirm-booking`

---

## ID & Data Model Rules (Non-Negotiables)

### IDs
- `provider_id` is a **UUID string** (Supabase UUID) everywhere: DB, API, Vapi tool calls, call variables.
- `attempt_id` is a **number** (integer) representing a scheduling attempt record.
- `proposal_id` is a **string** (UUID or other unique string) returned by propose/normalize logic.

Rationale:
- Supabase primary keys are UUID-shaped; using UUID for `provider_id` avoids brittle mapping layers.
- Prior mismatch (UUID in variables but number in tool schema) caused incorrect tool calls.

---

## Product Policy Decisions (Non-Negotiables)

### Consent → Call Behavior
Once a user grants permission to contact a medical office, the AI caller must:

1) Confirm whether an appointment is already on the office calendar.
   - If YES: capture appointment details (date/time/provider/location/requirements) and report back.
   - If NO: ask best-practice cadence / recommended follow-up timing.

2) Proceed to scheduling in the recommended timeframe.

This is core product value: the system verifies what’s already scheduled and determines the right next step without user guesswork.

---

## North-Star Scheduling Loop (End-State)

### Calendar-Driven Availability
The system will integrate with calendars (Google first; others later) so the AI only offers or accepts times that fit the user’s availability rules.

Core behaviors:
- Compute true free slots from calendar busy/free.
- Apply user preferences: working hours, buffers, travel time, “no mornings,” etc.
- The agent should never “guess” times—availability comes from the availability layer.

### Auto-Book Then Confirm (Default Model)
Default model:
1) Agent books the appointment using calendar-driven availability.
2) System notifies the user after booking with details.
3) User can keep or adjust.

### Adjustment Loop (Reschedule)
UI must include an **Adjust** button that triggers:
1) A reschedule attempt (new call context).
2) Agent calls office back to reschedule/cancel + book new time based on real availability.
3) System updates calendar + appointment state.

---

## Tool Contract (Interfaces We Will Evolve)

These tool endpoints are the long-term interface boundary. Internal logic will evolve (stubs → calendar-aware → fully automated),
but input/output shape must remain stable.

### `get_candidate_slots`
**Purpose:** Provide office-safe candidate times that are truly available.

Input:
- `attempt_id` (number)
- `provider_id` (string UUID)

Output (conceptual):
- `candidate_slots[]`: ISO start/end + timezone
- `message_to_say`: human-readable options for the agent to speak
- `next_action`: e.g. `ASK_FOR_ALTERNATIVE` | `OFFER_SLOTS`

### `propose_office_slot`
**Purpose:** Office offered a specific time; system must normalize + conflict-check.

Input:
- `attempt_id` (number)
- `provider_id` (string UUID)
- `office_offer.raw_text` (string)

Output (conceptual):
- `proposal_id` (string)
- `normalized_datetime` (ISO)
- `conflict` (boolean)
- if conflict: suggested alternatives

### `confirm_booking`
**Purpose:** Commit booking state and (later) write to calendar.

Input:
- `attempt_id` (number)
- `proposal_id` (string)

Output (conceptual):
- `booked` (boolean)
- appointment details payload for UI

---

## Call Variable Contract (start-call → Vapi)

When creating a Vapi call, the backend must pass the following variable values so the assistant prompt templates resolve:

Required:
- `attempt_id` (number)
- `provider_id` (string UUID)
- `patient_name` (string)
- `provider_name` (string)
- `preferred_timeframe` (string)

Optional / flags:
- `demo_autoconfirm` (boolean)

Rule:
- If variables are missing, prompts will contain blanks and call quality will degrade.

---

## MVP Scope (What We Ship First)

### MVP Goal
Demonstrate this loop reliably:
1) Provider selected (manual seed is fine)
2) Call initiated via backend
3) Webhook events received
4) Office offers time → tool round-trip works
5) Outcome displayed (even if minimal)

### MVP Explicitly Out of Scope (For Now)
- Google Calendar OAuth + real availability
- Writing to calendar
- Full “Adjust” reschedule implementation
- Plaid ingestion (can be mocked)
- Robust retry + edge-case handling

MVP must not block the end-state architecture; tool contracts remain stable as logic improves.

---

## Implementation Notes / Guardrails
- Backend/API is the system of record.
- UI should remain a thin client that renders status and triggers actions.
- Log and store webhook + tool call payloads.
- Always keep Vapi tool URLs + webhook URL pointed to Vercel.
- Avoid drift: update this file when making contract changes.