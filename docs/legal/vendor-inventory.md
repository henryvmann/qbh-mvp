# Quarterback Health — Subprocessor & Vendor Inventory

**Prepared for: outside counsel review**
**Date: 2026-04-22**

This inventory lists every third party that receives, processes, or stores Quarterback Health user data, the categories of data shared, the current contractual posture, and action items required.

---

## Legend

- **Status**: current state of contractual protection
  - `Signed` — BAA / DPA executed
  - `Available` — vendor offers the required agreement; QBH has not yet executed
  - `Required` — we need this agreement; confirm availability
  - `N/A` — not applicable (no PHI/regulated data flows to this vendor)
- **Priority**: urgency of action
  - `P0` — blocks launch
  - `P1` — must be in place within 30 days of launch
  - `P2` — should be addressed within 90 days
  - `P3` — nice to have

---

## Tier 1: subprocessors receiving Protected Health Information (PHI)

### Supabase (PostgreSQL database + Auth + Storage)
- **Provider**: Supabase Inc.
- **Role**: Primary application data store. Holds all user account data, patient profiles, providers, visits, appointments, voice-call metadata, audit logs.
- **Data categories sent**: All PHI, account credentials (hashed), audit logs.
- **Location of processing**: AWS us-east-1 (to confirm based on project region).
- **BAA status**: **Required** — offered by Supabase on Team and Enterprise tiers.
- **Current plan tier**: to confirm. BAA requires Team or higher.
- **Encryption**: At-rest encryption (AES-256) and TLS in transit on paid tiers.
- **Subprocessors**: AWS, Cloudflare.
- **Priority**: **P0**. Cannot launch without BAA.

### OpenAI (GPT-4o and GPT-4o-mini via API)
- **Provider**: OpenAI, L.L.C.
- **Role**: Powers Kate chat, daily insights, transaction classification, call-outcome classification, goal suggestions, call-quality admin.
- **Data categories sent**:
  - Kate chat: patient profile snippets, provider names, insurance, message history
  - Insights: provider list, overdue state, upcoming appointments
  - Transaction classification: merchant names (no user PII)
  - Call outcome classification: call transcripts
- **BAA status**: **Required** — OpenAI offers a BAA on Zero Data Retention enterprise agreements.
- **Priority**: **P0**. Cannot launch without BAA if QBH is classified as CE or BA.

### VAPI (voice agent infrastructure)
- **Provider**: Vapi, Inc.
- **Role**: Orchestrates outbound phone calls placed by Kate. Handles speech-to-text, LLM orchestration, text-to-speech, SIP telephony via Twilio.
- **Data categories sent**: Patient name, DOB, insurance provider, insurance member ID, callback phone, provider phone, call audio, call transcripts.
- **BAA status**: **Required** — VAPI offers a BAA.
- **Data retention**: VAPI retains call recordings and transcripts per their retention policy. Confirm specific retention period and whether we can delete on user request.
- **Subprocessors**: Twilio (telephony), OpenAI/Anthropic (LLM), Deepgram/ElevenLabs (STT/TTS) — to confirm.
- **Priority**: **P0**.

### Vercel (application hosting)
- **Provider**: Vercel, Inc.
- **Role**: Hosts the Next.js application. Processes all user traffic in memory; retains access logs.
- **Data categories sent**: All traffic. Access logs contain IP addresses, paths, status codes. Request bodies and response bodies may contain PHI in transit.
- **BAA status**: **Required** — Vercel offers a BAA on Enterprise tier.
- **Priority**: **P0** if QBH is classified as CE or BA. **P1** otherwise.

### Google Workspace (Calendar API)
- **Provider**: Google LLC
- **Role**: OAuth-authenticated read of user calendar events for availability check during booking.
- **Data categories sent**: Calendar event titles, start/end times. Titles often contain provider or appointment context.
- **BAA status**: **Available** — Google Workspace offers a BAA for eligible services (Calendar is included).
- **Priority**: **P1**.

### Apple Push Notifications (future)
- **Provider**: Apple Inc.
- **Role**: Delivers push notifications to iOS devices.
- **Data categories sent**: Notification payload — may contain appointment details, reminders, Kate's messages.
- **BAA status**: **Required if notifications contain PHI**. Apple does not currently offer a BAA; alternative is to send notifications with generic payloads and fetch content in-app.
- **Priority**: **P1** (depends on whether notifications ship at launch).

### Epic (future — FHIR integration)
- **Provider**: Epic Systems Corp. (and each hospital system)
- **Role**: Clinical record source via FHIR API.
- **Data categories received**: Patient demographics, problem list, medications, allergies, appointments, visit summaries.
- **Contractual posture**: QBH becomes a business associate to each covered entity granting access. App Market / App Orchard registration establishes the relationship.
- **Priority**: **P1** — tied to Epic distribution launch.

---

## Tier 2: subprocessors receiving regulated non-PHI data

### Plaid (financial data aggregation)
- **Provider**: Plaid Inc.
- **Role**: Bank/credit card connection; transaction fetch.
- **Data categories sent**: User bank authentication (via OAuth link flow). Plaid sends transaction data to QBH.
- **Regulatory scheme**: Gramm-Leach-Bliley Act (GLBA) — financial data privacy. NOT HIPAA.
- **Contract posture**: Plaid's standard Data Processing Addendum + Privacy Policy terms.
- **Priority**: **P1**. Confirm current DPA is executed; confirm Plaid classifies QBH use case correctly.

### Twilio (via VAPI)
- **Provider**: Twilio, Inc.
- **Role**: SIP / PSTN telephony for calls initiated by VAPI.
- **Data categories sent**: Phone numbers (caller, callee), call metadata, call audio.
- **BAA status**: **Available** — Twilio offers a BAA.
- **Current posture**: QBH does not directly contract with Twilio; relationship is via VAPI's subprocessor chain.
- **Priority**: **P0** — confirm VAPI's BAA covers the Twilio subprocessor chain.

---

## Tier 3: services not receiving PHI

### NPI Registry (CMS public API)
- **Provider**: Centers for Medicare & Medicaid Services
- **Role**: Provider name / NPI lookup.
- **Data sent**: Provider search queries only. No user data.
- **BAA status**: **N/A** — public government API.
- **Priority**: N/A.

### Google Places API (Maps)
- **Provider**: Google LLC
- **Role**: Look up phone numbers for discovered providers.
- **Data sent**: Business name, city, state. No user PHI.
- **BAA status**: **N/A** — no PHI shared.
- **Priority**: N/A.

### Google Analytics 4
- **Provider**: Google LLC
- **Role**: Website and web-app usage analytics (page views, event counts, session metadata).
- **Data categories sent**: Interaction events, page paths, referring source, anonymized IP, device/browser metadata. No PHI, no account identifiers, no health data.
- **Regulatory posture**: Service provider under executed Data Processing Amendment (accepted April 2, 2026). Configured 2026-04-22 to service-provider-only mode: Google Signals disabled, data sharing with Google products disabled across all four categories, ads personalization disabled in all 307 regions, granular location/device collection disabled, data retention set to 2 months. Google Consent Mode v2 Advanced deployed in `src/app/layout.js`. GA4 fires only after affirmative user consent captured via Cookiebot.
- **BAA status**: **N/A** — Google does not provide a BAA for GA4. No PHI transmitted; service-provider DPA accepted.
- **Compliance record**: `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md` (Change ID QBH-COMP-2026-04-22-001).
- **Priority**: **Resolved**.

### Cookiebot (by Cybot A/S)
- **Provider**: Cybot A/S (Denmark)
- **Role**: Consent management platform. Captures user consent for cookie categories (Necessary, Statistics, Preferences, Marketing), honors Global Privacy Control (GPC) signals, logs consent decisions for audit, implements Google Consent Mode v2 Advanced signaling.
- **Data categories sent**: Consent decisions, anonymized visitor identifiers, regional metadata for geographic banner behavior. No PHI.
- **BAA status**: **N/A** — no PHI shared. Standard DPA under Cybot's terms.
- **Compliance record**: Deployed 2026-04-22. Same compliance record as GA4 above.
- **Priority**: **Resolved**.

---

## Tier 4: corporate / operational vendors (add as onboarded)

*The vendors in this section do not currently receive production user data but will once operationalized. Include in privacy policy as applicable.*

| Vendor | Purpose | Data shared | Agreement |
|---|---|---|---|
| Stripe (when payments launched) | Payment processing | Cardholder data tokenized by Stripe | Standard Stripe DPA |
| Apple Small Business Program | iOS subscriptions | Subscription metadata | Apple Developer Agreement |
| Google Play | Android subscriptions | Subscription metadata | Play Developer Agreement |
| Email provider (TBD: Resend / Postmark / SES) | Transactional email | Email address, message content | Provider DPA + BAA if PHI |
| Observability (TBD: Sentry / PostHog / Datadog) | Error / analytics | Potentially user identifiers, session data | Provider DPA; watch PII leakage |
| Support tool (TBD: Intercom / Front) | Customer support | Email conversations may contain PHI | BAA required if PHI |

---

## Summary action items

| # | Vendor | Action | Priority |
|---|---|---|---|
| 1 | Supabase | Confirm plan tier supports BAA; execute BAA | P0 |
| 2 | OpenAI | Execute BAA under zero-retention enterprise agreement | P0 |
| 3 | VAPI | Execute BAA; confirm retention policy and deletion-on-request | P0 |
| 4 | Vercel | Execute BAA on Enterprise tier | P0/P1 |
| 5 | Twilio | Verify coverage via VAPI subprocessor chain | P0 |
| 6 | Plaid | Verify DPA executed and current | P1 |
| 7 | Google Workspace | Execute BAA for Calendar access | P1 |
| 8 | Apple Push | Decide: generic payloads vs alternative provider | P1 |
| 9 | Epic | Register for App Market; execute required agreements | P1 |
| 10 | Stripe | Execute DPA before processing payments | P1 |
| 11 | Email / observability / support tools | Select vendors; execute BAA where applicable | P2 |
| 12 | Google Analytics 4 | DPA accepted; service-provider reconfiguration completed 2026-04-22 | **Resolved** |
| 13 | Cookiebot | Deployed 2026-04-22 with Google Consent Mode v2 Advanced and GPC honoring | **Resolved** |
