# Quarterback Health — Data Flow Diagram

**Prepared for: outside counsel review**
**Date: 2026-04-22**
**Product: Quarterback Health (QBH) consumer healthcare management application**

---

## 1. Overview

Quarterback Health is a consumer-facing healthcare management application. Users connect a bank account to automatically discover their healthcare providers, track appointments and care gaps, and authorize an AI voice agent ("Kate") to place telephone calls to healthcare offices on their behalf to schedule appointments.

The application is delivered as a Next.js web application hosted on Vercel, and packaged as native iOS and Android applications via Capacitor.

Data moves between the user's device, the QBH application, and a defined set of third-party subprocessors. This document maps that data flow.

---

## 2. Categories of data collected

| Category | Examples |
|---|---|
| **Account data** | Name, email, password (hashed), phone number |
| **Patient profile** | Date of birth, insurance provider, insurance member ID, callback phone |
| **Care recipient data** | Data about partner, children, parents managed under the user's account |
| **Healthcare provider data** | Provider names, phone numbers, specialties, NPIs, addresses, visit history |
| **Appointment data** | Scheduled appointments, proposed times, booking outcomes |
| **Financial data (transactional)** | Bank/credit card transactions (via Plaid) used solely to identify healthcare merchants |
| **Voice call data** | Audio recordings of calls placed by Kate, transcripts, outcomes |
| **Chat data** | Text messages exchanged with Kate chat assistant |
| **Usage / audit data** | Timestamps, IP addresses, actions taken |
| **Calendar data (optional)** | Busy-time information from Google Calendar / Outlook |
| **Clinical data (future)** | Medical records received from Epic FHIR integration |

---

## 3. High-level data flow

```
   ┌────────────────────────────────────────────────────────────────┐
   │                      USER DEVICE                               │
   │              (iOS app / Android app / web browser)             │
   │                                                                │
   │   Collects: account info, patient profile, care recipients,    │
   │             consent to ToS / PHI use / AI calls                │
   └────────────────────────────────────────────────────────────────┘
                                 │
                          TLS (HTTPS 1.3)
                                 │
                                 ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                   QBH APPLICATION                              │
   │                   (Next.js on Vercel)                          │
   │                                                                │
   │   • Supabase Auth session management                           │
   │   • API routes (server-side business logic)                    │
   │   • Audit logging of sensitive actions                         │
   │   • Row-Level Security enforced for all DB reads               │
   │   • Per-call user consent verified before voice initiation     │
   │   • Calling-hours restrictions (9 AM – 6 PM ET, Mon–Fri)       │
   └────────────────────────────────────────────────────────────────┘
         │            │            │            │            │
         │            │            │            │            │
         ▼            ▼            ▼            ▼            ▼
    ┌────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐
    │Supabase│  │ OpenAI  │  │  VAPI   │  │  Plaid  │  │  Google    │
    │Postgres│  │ (Azure- │  │ (voice  │  │  (bank  │  │  Places /  │
    │ + Auth │  │  routed │  │  agent) │  │  tx)    │  │  Calendar  │
    │        │  │  GPT-4o │  │ + Twilio│  │         │  │            │
    │  DB    │  │ +  mini)│  │ (SIP)   │  │  GLBA   │  │            │
    └────────┘  └─────────┘  └─────────┘  └─────────┘  └────────────┘
                                  │
                                  │ (places outbound phone call)
                                  ▼
                         ┌─────────────────┐
                         │ Healthcare      │
                         │ office          │
                         │ (covered entity)│
                         └─────────────────┘

   FUTURE INTEGRATIONS:

   ┌────────────┐                                  ┌─────────────┐
   │ Epic on    │◄── OAuth 2.0 / FHIR R4 ─────────┤   Apple     │
   │ FHIR       │                                  │   Push      │
   │ (covered   │    Relationship: QBH is a        │   Notifs    │
   │  entity)   │    business associate to Epic    │             │
   └────────────┘    for this data flow            └─────────────┘
```

---

## 4. Detailed flow: new user onboarding

1. User opens app and lands on signup (iOS, Android, or web).
2. User completes preference surveys (no PHI: e.g. "who are you managing").
3. User provides account credentials: first name, last name, email, password.
4. User checks a single consent box agreeing to Terms of Service, Privacy Policy, and authorizing QBH "to call offices and use my info to organize my care."
5. QBH creates a Supabase Auth user and an `app_users` row containing the user's patient profile.
6. User is offered optional connection to Plaid (bank) and Google Calendar.
7. If Plaid connected: QBH fetches up to 12 months of transactions via Plaid, groups by merchant, sends merchant names and transaction metadata (no user PII) to OpenAI for classification as healthcare / not-healthcare.
8. QBH performs NPI lookups (CMS public API) and Google Places phone lookups for classified healthcare merchants.
9. User reviews discovered providers, approves/rejects, and can add additional providers manually.

---

## 5. Detailed flow: voice call (booking an appointment)

1. User selects a provider in the UI and taps "Book" or "Handle it."
2. QBH server validates: user consent recorded, full patient profile complete, call within allowed hours (9 AM – 6 PM ET, Mon–Fri).
3. QBH creates a `schedule_attempt` record in Supabase with user/provider metadata.
4. QBH calls VAPI API to initiate outbound call, passing:
   - Patient name, date of birth, insurance provider, insurance member ID, callback phone (formatted for natural speech)
   - Target provider phone number
   - Availability context (from connected calendar, if any)
   - VAPI assistant ID + assistant override parameters
5. VAPI connects via Twilio to the healthcare office phone line.
6. Kate (AI voice agent, powered by OpenAI/Claude on VAPI's infrastructure) speaks to the receptionist.
7. During the call, Kate uses VAPI tools that call back to QBH API routes to:
   - Propose office-offered slots against user availability
   - Confirm booking
   - Handle voicemail / no-availability fallbacks
8. On call end, VAPI posts a webhook to QBH with call metadata, transcript, and recording URL.
9. QBH classifies the call outcome via OpenAI (gpt-4o-mini) and writes results to `schedule_attempts`, `proposals`, and `calendar_events` tables.

---

## 6. Detailed flow: Kate chat

1. User opens Kate chat sidebar.
2. QBH server assembles user context: providers, upcoming appointments, recent visits, patient profile (name, focus areas).
3. QBH sends context + user message to OpenAI (gpt-4o) with tool definitions (e.g. `search_providers`).
4. OpenAI may return a tool call, which QBH executes server-side (e.g. NPI/Places lookup) and sends back with a second OpenAI call.
5. OpenAI returns a response, streamed to the user.

---

## 7. Detailed flow: daily insights

1. Once per day, QBH generates personalized insights for each user (cached in `kate_insights`).
2. QBH sends user's health context (providers, overdue visits, upcoming appointments, focus areas) to OpenAI (gpt-4o-mini).
3. OpenAI returns JSON-structured insights of types: upcoming_prep, care_gap, encouragement, action_needed, tip, connection.
4. Insights displayed in the user's dashboard. Cached for 24 hours or until dismissed.

---

## 8. Third-party data destinations and categories

| Destination | Category of data sent | Purpose | Regulatory scheme |
|---|---|---|---|
| Supabase (Postgres + Auth) | All QBH-collected data, including PHI | Primary data store, authentication | HIPAA, state privacy laws |
| OpenAI (gpt-4o, gpt-4o-mini) | Kate chat context (provider names, insurance, basic profile), transaction merchant names, call transcripts | Chat responses, insights, classification | HIPAA (if BAA signed) |
| VAPI (voice infrastructure) | Patient name, DOB, insurance, callback phone, provider phone, full call audio | Voice call placement, recording | HIPAA |
| Twilio (via VAPI) | Telephony only; inherits data from VAPI | SIP/PSTN connectivity | HIPAA (via VAPI's BAA) |
| Plaid | Plaid bank OAuth token; Plaid returns transaction data to QBH | Healthcare-transaction discovery | Gramm-Leach-Bliley Act (GLBA) |
| Google Places API | Provider business name, city, state (public data) | Phone number lookup | N/A — no PHI sent |
| Google Calendar (optional) | Calendar busy-time data; appointment titles containing provider names | Conflict-check during booking | Potentially PHI (appt titles) |
| NPI Registry (CMS) | Provider search queries only | Provider information lookup | Public API — no PHI |
| Vercel | Entire application traffic (processed in memory; logs retained per Vercel policy) | Hosting | HIPAA (if BAA signed) |
| Apple Push Notifications | Notification text (may include appointment reminders) | Push notifications | Potentially PHI |
| Epic (future) | OAuth tokens; Epic sends QBH clinical records | Medical record integration | HIPAA (QBH is BA to Epic) |

---

## 9. Data retention

| Data | Retained until | Notes |
|---|---|---|
| Account + patient profile | Account deleted | User can delete account via `/api/account/delete` |
| Providers, visits, appointments | Account deleted | Cascade-deleted on account deletion |
| Call recordings (VAPI) | Per VAPI retention policy | **Unknown — to confirm with VAPI** |
| Call transcripts / metadata | Account deleted | Stored in `schedule_attempts`, `proposals`, `call_events` |
| Kate chat history | Not currently persisted server-side | In-session only; no chat history table observed |
| Kate insights | Account deleted | Deleted per `account/delete` route |
| Audit logs | Account deleted | `audit_logs` table, cascade-deleted |
| Plaid transactions | Account deleted | Deleted per `account/delete` route |
| Supabase backups | Per Supabase retention | Point-in-time recovery retains data after deletion |

---

## 10. User rights exercised today

- **Access**: users see their own data in the app UI.
- **Correction**: users can edit provider details, patient profile, care recipients.
- **Deletion**: users can delete their account via in-app settings, which deletes across 17 tables plus Supabase Auth. See section 9 for residual backup exposure.
- **Portability**: no current export mechanism.
- **Opt-out of processing**: no current mechanism beyond account deletion.

---

## 11. Known gaps (to be addressed with counsel)

1. **Terms of Service and Privacy Policy not yet published.** The consent checkbox during signup links to `#` placeholders.
2. **Single bundled consent checkbox** combines three distinct authorizations (ToS, PHI, AI-call authorization) into one input.
3. **Call recording consent** may be insufficient for two-party-consent states (CA, FL, IL, MA, MD, MT, NH, PA, WA).
4. **AI disclosure to called parties** — requirements vary by state (e.g., CA SB 1001, Colorado AI Act).
5. **VAPI call audio retention** not independently verified.
6. **Supabase backup retention** after user deletion not addressed in current deletion flow.
7. **Data export mechanism** not implemented (may be required under state privacy laws).
8. **Minors' data handling** — users tracking children; COPPA review needed.
9. **Marketing claims** — some landing pages use "securely," "private," "read-only" language; needs counsel review (see marketing-copy-audit.md).
10. **No written Incident Response Plan** on file.
11. **No Security Risk Assessment** performed (would be required if classified as Covered Entity or Business Associate).
12. **Subprocessor BAA status** requires confirmation for: Supabase, OpenAI, VAPI, Vercel, Google (Workspace / Calendar), Apple.
