# Vercel Environment Checkpoint — Feb 22, 2026

## Deployment
- Production URL: https://qbh-mvp.vercel.app
- Repo: https://github.com/henryvmann/qbh-mvp
- Framework: Next.js App Router (src/app)

## Required Environment Variables (names only — NEVER commit values)

### Supabase
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

### Vapi
- VAPI_API_KEY
- VAPI_ASSISTANT_ID
- VAPI_PHONE_NUMBER_ID

### App
- PUBLIC_BASE_URL

## Notes / Guardrails
- Vapi tools must point to production URLs:
  - https://qbh-mvp.vercel.app/api/vapi/start-call
  - https://qbh-mvp.vercel.app/api/vapi/propose-office-slot
  - https://qbh-mvp.vercel.app/api/vapi/confirm-booking
  - https://qbh-mvp.vercel.app/api/vapi/webhook

- Never commit .env.local
- Service role key is server-side only