# Booking Loop Stable Checkpoint – 2026-02-26

## Supabase Project
Project ref: `fzrolxuu...`  
Environment: `.env.local`

## RPC Signature
`public.finalize_confirm_booking(p_attempt_id bigint, p_proposal_id uuid)`

## Key Schema Rules
- `calendar_events.id` → uuid
- `schedule_attempts.id` → bigint
- `schedule_attempts.user_id` → uuid NOT NULL
- `calendar_events.user_id` → uuid NOT NULL
- `portal_facts.user_id` → uuid NOT NULL

## Unique Index (Partial)

uq_calendar_events_provider_start_confirmed
(provider_id, start_at)
WHERE status = 'confirmed'


## Idempotent Confirm Logic

ON CONFLICT (provider_id, start_at)
WHERE status = 'confirmed'
DO UPDATE ...


## Smoke Test Command
```bash
BASE_URL=http://localhost:3000 ./scripts/smoke-tools.sh

Status: ✅ Fully green (propose → confirm → writeback → repeat safe)


Save the file.

---

# ✅ Step 3 — Commit It

```bash
git add docs/BOOKING_LOOP_STABLE_2026_02_26.md
git commit -m "checkpoint: booking loop stable + schema alignment"
git push