
# QBH Project Checkpoint — March 2026

## Production
Domain: https://getquarterback.com
Hosting: Vercel

## Core Stack
Frontend: Next.js (App Router)
Backend: Supabase (Postgres)
AI Calling: Vapi
Deployment: Vercel

## Current User Flow
/           Home
/start      Household Setup
/connect    Account Connect
/dashboard  Dashboard

## Working Capabilities
- Provider dashboard
- AI phone scheduling
- Deterministic booking loop
- Calendar event writeback
- Provider discovery animation

## Key Database Tables
providers
schedule_attempts
calendar_events

## AI Tool Contracts
provider_id → UUID string
attempt_id → number

## Deployment Notes
All backend routes deployed via Vercel.
Supabase is the system of record.
