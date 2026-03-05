# QBH Checkpoint – Feb 20, 2026

## Infrastructure
- Deployed on Vercel (production)
- App Router under src/app
- All tool endpoints active:
  - /api/vapi/start-call
  - /api/vapi/propose-office-slot
  - /api/vapi/get-candidate-slots
  - /api/vapi/confirm-booking
  - /api/vapi/webhook
- No duplicate route handlers

## Tool Contract
Vapi Tools require:
{
  "results": [
    {
      "toolCallId": "...",
      "result": "JSON string"
    }
  ]
}

propose_office_slot returns:
- message_to_say
- next_action
- proposal_id
- conflict

confirm_booking returns:
- message_to_say
- next_action: END_CALL
- status: BOOKED

## Demo Mode
- demo_autoconfirm flag supported
- When true:
  - propose_office_slot returns CONFIRM_BOOKING
  - assistant immediately confirms booking
  - assistant ends call politely

## Current Limitation
- Vapi outbound daily call limit reached
- System blocked from additional outbound tests today
- Must wait for reset or connect Twilio

## Next Phase
Move to Supabase:
- Create schedule_attempts table
- Create proposals table
- Persist tool outcomes
- Build minimal UI state view

