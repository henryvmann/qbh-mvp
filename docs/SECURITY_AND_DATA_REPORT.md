# Quarterback Health — Security & Data Practices Report
## Prepared for Legal Counsel — April 2026

---

## 1. Company Profile

**Product:** Quarterback Health (QBH) — AI-powered healthcare management platform
**Stage:** Pre-launch MVP
**Users:** Internal testing only (no external users yet)
**Hosting:** Vercel (serverless, US East)
**Database:** Supabase (PostgreSQL, hosted on AWS US East)
**Domain:** getquarterback.com

---

## 2. What Data We Collect

### Patient Information (PHI)
| Data Field | Collected From | Purpose |
|---|---|---|
| Full name (first + last) | User input during onboarding | Identifying patient to offices during calls |
| Date of birth | User input (pre-call form) | Office verification during appointment booking |
| Insurance provider name | User input (pre-call form) | Shared with office during booking calls |
| Insurance member ID | User input (pre-call form) | Shared with office during booking calls |
| Phone number | User input (pre-call form) | Callback number for offices |
| Healthcare providers | Plaid transactions, manual entry, or calendar scan | Track care relationships |
| Visit history (dates + amounts) | Plaid transaction analysis | Identify overdue care |
| Appointment dates/times | VAPI booking system + calendar integrations | Schedule management |
| Call transcripts | VAPI webhook (phone calls to offices) | Call notes, quality assurance |
| Survey answers | Onboarding questionnaire | Personalize experience |

### Financial Data
| Data Field | Source | Purpose |
|---|---|---|
| Bank transaction history (12 months) | Plaid | Discover healthcare providers from payment patterns |
| Transaction merchant names | Plaid | Classify healthcare vs non-healthcare |
| Transaction amounts | Plaid | Visit cost tracking |

### Authentication Data
| Data Field | Purpose |
|---|---|
| Email address | Account login |
| Password (hashed by Supabase Auth) | Account login |
| Session tokens | Maintaining logged-in state |

---

## 3. Where Data Is Stored

**Primary Database:** Supabase PostgreSQL
- All patient data stored in Supabase tables
- Row-Level Security (RLS) enabled on all user-facing tables
- Users can only access their own data
- Backend operations use service role key (bypasses RLS for write operations)

**Encryption at Rest:** Supabase provides transparent disk encryption (AES-256) for all PostgreSQL data. No additional application-layer encryption is currently implemented for individual fields.

**Encryption in Transit:** All connections use TLS/HTTPS. No unencrypted HTTP connections exist in the application.

**OAuth Tokens:** Access and refresh tokens for Google Calendar, Outlook Calendar, Plaid, and Epic are stored in the database. These tokens provide API access to the respective services.

---

## 4. Third-Party Services & Data Sharing

### Services That Receive PHI

| Service | What PHI Is Shared | BAA Status | Purpose |
|---|---|---|---|
| **OpenAI** (gpt-4o-mini) | Patient name, provider names, visit dates, insurance info, call transcripts | **BAA SIGNED** | Kate chat, appointment prep, call classification, insights |
| **VAPI** | Patient name, DOB, insurance, member ID, phone, provider names | **BAA available** (HIPAA Mode — needs to be enabled + signed) | AI phone calls to book appointments |
| **ElevenLabs** (via VAPI) | Text of what Kate says on calls (includes patient name, DOB) | **No BAA** (covered under VAPI's HIPAA Mode — needs confirmation) | Text-to-speech voice generation |
| **Deepgram** (via VAPI) | Audio of phone calls (office + Kate conversation) | **No BAA** (covered under VAPI's HIPAA Mode — needs confirmation) | Speech-to-text transcription |
| **Plaid** | Bank account access (read-only transactions) | **Not assessed** | Discover healthcare providers from transaction patterns |
| **Supabase** | All stored data | **BAA available** (Pro plan — needs to be signed) | Database hosting |
| **Vercel** | Processes API requests containing PHI | **BAA available** (Enterprise plan — needs to be signed) | Application hosting |

### Services That Do NOT Receive PHI

| Service | What Is Shared | Purpose |
|---|---|---|
| **NPI Registry** (CMS) | Provider names (public data) | Look up provider credentials and phone numbers |
| **Google Places API** | Business names (public data) | Find provider phone numbers and locations |
| **Google Calendar API** | Calendar availability queries (no PHI sent) | Check scheduling conflicts |
| **Outlook Calendar API** | Calendar availability queries (no PHI sent) | Check scheduling conflicts |
| **Epic FHIR** | OAuth credentials only (PHI received, not sent) | Pull patient medical records |

---

## 5. BAA Status Summary

| Vendor | Status | Action Needed |
|---|---|---|
| OpenAI | **SIGNED** | Enable zero-data-retention in org settings |
| VAPI | **Available** | Enable HIPAA Mode in dashboard + sign BAA add-on |
| Twilio (VAPI telephony) | **Not contacted** | Email hipaa@twilio.com |
| ElevenLabs | **Uncertain** | Confirm if covered under VAPI's HIPAA Mode |
| Deepgram | **Uncertain** | Confirm if covered under VAPI's HIPAA Mode |
| Supabase | **Available** | Upgrade to Pro plan + sign BAA |
| Vercel | **Available** | Contact sales for Enterprise plan + BAA |
| Plaid | **Not assessed** | Financial data (not PHI) — lower priority |

---

## 6. Authentication & Access Control

### User Authentication
- Email + password authentication via Supabase Auth
- Passwords hashed using bcrypt (Supabase default)
- Session managed via HTTP-only cookies (web) or Bearer tokens (mobile)
- Auto-confirmed email (no email verification step during onboarding)
- No multi-factor authentication (MFA) currently implemented

### Admin Access
- Separate admin panel at /admin/* routes
- Protected by a single shared password (environment variable)
- Admin can view: all user accounts, call quality metrics, call transcripts
- No individual admin accounts or audit trail

### API Security
- All API routes require authenticated session (via Supabase Auth)
- Public routes limited to: landing page, login, onboarding
- VAPI webhook accepts incoming calls with no additional authentication (relies on Supabase service role for writes)

---

## 7. Data Retention

**Current Policy:** No formal data retention policy. All data is retained indefinitely.

**Recommended Policy (for legal review):**
- Patient profile data: Retained while account is active + 7 years after deletion (HIPAA minimum)
- Call transcripts: Retained for 3 years (quality assurance), then purged
- Financial transaction data: Retained for 1 year after last use, then purged
- OAuth tokens: Retained while connection is active, revoked on disconnect
- Session tokens: Expire per Supabase defaults (7 days refresh)

---

## 8. Data Deletion

**Current Status:** No account deletion feature exists.

**Planned Implementation:**
- Account deletion endpoint that cascades across all tables
- Revokes all OAuth tokens (Plaid, Google, Outlook, Epic)
- Removes all PHI, call transcripts, visit history, and provider data
- Retains anonymized aggregate data only (if needed for analytics)
- Confirmation email before deletion
- 30-day grace period before permanent deletion

---

## 9. What We Do NOT Do

- We do NOT sell or share patient data with advertisers
- We do NOT use patient data for model training (OpenAI BAA includes zero-retention)
- We do NOT store credit card or payment information (Plaid is read-only)
- We do NOT record phone call audio (transcripts only, via VAPI webhook)
- We do NOT access patient bank accounts (Plaid is read-only, transactions only)
- We do NOT provide medical advice (Kate is a scheduling assistant, not a clinician)
- We do NOT store data outside the US (Supabase US East, Vercel US East)

---

## 10. Security Measures In Place

### Currently Implemented
- HTTPS/TLS on all connections
- Row-Level Security on all database tables
- Supabase disk encryption (AES-256)
- Password hashing (bcrypt)
- PKCE OAuth flows (Epic FHIR)
- Admin panel password-protected
- Environment variables for all secrets (not hardcoded)
- Server-side only API calls (no client-side secret exposure)

### Planned Before Launch
- Enable OpenAI zero-data-retention
- Sign outstanding BAAs (VAPI, Supabase, Vercel)
- Implement account deletion
- Add audit logging for PHI access
- Implement formal data retention policy
- Review and minimize console logging in production
- Add rate limiting on authentication endpoints

---

## 11. Recommendations for Legal Review

1. **Privacy Policy should disclose:** All third-party services that receive PHI (OpenAI, VAPI, Supabase, Vercel), the types of PHI collected, and the purposes for each.

2. **Terms of Service should include:** Disclaimer that Kate is a scheduling assistant (not medical provider), limitation of liability for missed/incorrect appointments, user consent for AI-powered phone calls on their behalf.

3. **HIPAA considerations:** With signed BAAs from all vendors handling PHI, QBH can operate as a Business Associate. The platform does not perform treatment, payment, or healthcare operations directly — it facilitates scheduling.

4. **State privacy laws:** CCPA (California), CTDPA (Connecticut), and other state laws may apply. Account deletion and data portability features should be implemented.

5. **Consent:** Users currently consent implicitly by creating an account. Consider explicit consent checkboxes for: (a) AI phone calls on their behalf, (b) sharing PHI with third-party AI services, (c) accessing financial transaction data.

---

*This document reflects the current state of the QBH MVP platform as of April 2026. It is intended to support legal counsel in drafting Privacy Policy and Terms of Service documents.*
