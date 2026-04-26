# Quarterback Health — Security Measures

**Prepared for: outside counsel review**
**Date: 2026-04-22**

This memorandum inventories the technical and administrative safeguards currently implemented in the Quarterback Health application, identifies known gaps, and lists recommended next steps. It is intended to inform counsel's advice on regulatory scope, required remediation, and marketing-compliance exposure.

---

## 1. Authentication and access control

### Implemented
- **User authentication**: Supabase Auth (email + password). Passwords are hashed by Supabase using bcrypt-equivalent.
- **Session management**: Supabase session cookies with HTTPOnly and Secure attributes.
- **Row-Level Security (RLS)**: Enforced on all user-scoped tables in Supabase Postgres. Users accessing data through the anon key see only their own rows. Migration `db/migrations/2026-03-rls.sql` documents policies.
- **Server-only privileged access**: The Supabase service-role key is used exclusively in server-side API routes and never exposed to the client.
- **Per-request authorization**: All API routes that touch user data call `getSessionAppUserId` to verify the current session before performing queries.
- **Forgot password / password reset**: Implemented via Supabase Auth.

### Gaps
- No enforced password complexity beyond minimum length of 6 characters.
- No multi-factor authentication (MFA) required for users.
- No MFA enforced for internal staff on Supabase, Vercel, VAPI, or OpenAI dashboards (to confirm).
- No session timeout / inactivity expiration configured beyond Supabase defaults.
- No role-based access control within QBH (all authenticated users have identical permissions; no admin tier or support tier).

---

## 2. Transport and storage encryption

### Implemented
- **Transport encryption**: All application traffic served over HTTPS (TLS 1.2+). Vercel provides managed TLS.
- **Database encryption at rest**: AES-256 encryption at rest on paid Supabase tiers.
- **Backup encryption**: Supabase-managed backups are encrypted at rest.

### Gaps
- **Application-level field encryption**: Highly sensitive fields (insurance member ID, date of birth, full name) are stored in plaintext within the `app_users.patient_profile` JSONB column, relying solely on database-level encryption and RLS. Application-level encryption with a per-user or per-tenant key is not implemented.
- **Key management**: No documented key rotation policy for Supabase service keys, VAPI keys, OpenAI keys, Plaid keys.
- **VAPI call audio encryption at rest**: Retention and encryption posture to confirm directly with VAPI.

---

## 3. Audit logging

### Implemented
- **`audit_logs` table**: Records app_user_id, action, resource_type, resource_id, details (JSONB), IP address, and timestamp.
- **Instrumented routes**: Account deletion, admin reads, dashboard data access, patient profile updates, and VAPI call initiation write audit entries.
- **Non-blocking**: Audit writes wrapped in try/catch to avoid blocking primary flows on logging failures.

### Gaps
- **Log completeness**: Not all PHI-accessing routes instrumented. A full route-level audit coverage review is needed.
- **Log retention**: `audit_logs` rows are deleted on account deletion per `account/delete`. HIPAA requires six-year retention for covered entities / business associates — resolve this conflict with counsel.
- **Log integrity**: No tamper protection (e.g., append-only storage, WORM, hashing chain).
- **Centralized monitoring**: No SIEM or log alerting system in place.

---

## 4. Consent management

### Implemented
- **Onboarding consent**: Single checkbox during account creation gathers three consents simultaneously: (1) agree to Terms of Service, (2) agree to Privacy Policy, (3) authorize QBH to call offices and use personal information to organize care.
- **Consent record storage**: Consent state stored in the `app_users` record with a timestamp.
- **Per-call capacity**: Kate voice calls are gated by a check that the user's full patient profile is populated and consent has been recorded.
- **Cookie consent (Cookiebot)**: Deployed 2026-04-22. Cookiebot consent management platform captures affirmative opt-in for cookie categories (Necessary, Statistics, Preferences, Marketing), with Google Consent Mode v2 Advanced signaling and Global Privacy Control (GPC) signal honoring enabled. Consent decisions are logged for audit. Google Analytics 4 is gated behind affirmative Statistics-category consent and does not fire pre-consent. See `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md`.

### Gaps
- **Bundled consent**: The three consents are combined into one checkbox. Separate, granular consents are stronger legally (and often required).
- **Missing policy documents**: The Terms of Service and Privacy Policy links in the consent UI currently point to `#` placeholders. No policies are published. Cookiebot banner "Privacy Policy" link requires a live URL rather than a placeholder.
- **Recording consent text**: The authorization does not explicitly disclose that Kate calls are recorded, which may be insufficient for two-party-consent states.
- **No AI disclosure consent**: The fact that Kate is an AI voice agent is not explicitly disclosed during onboarding (it is disclosed on the call if asked).
- **No withdrawal of consent mechanism** beyond account deletion (cookie preferences can be changed via Cookiebot's banner but in-product consents cannot).

---

## 5. Application-level operational controls

### Implemented
- **Calling-hours restriction**: Voice calls can only be placed between 9 AM and 6 PM Eastern, Monday–Friday. Attempts outside these hours are rejected.
- **Per-call validation**: Calls require full patient profile, explicit provider target, and valid authorization. Calls are rate-limited per user.
- **Demo / test mode**: `DEMO_CALL_TO_NUMBER` and `USE_TEST_ASSISTANT` environment variables allow non-production flows to avoid real office calls.
- **AI disclosure during call**: Kate's voice-agent system prompt instructs her to disclose she is AI if asked directly by the office.
- **Duration and cost limits**: VAPI-side timeouts and voicemail detection reduce runaway call risk.

### Gaps
- **No explicit AI proactive disclosure**: Kate discloses AI status reactively (only if asked), not proactively at call open. Some states may require proactive disclosure.
- **No cross-user rate limits**: A compromised account could trigger many calls before rate limiting kicks in.
- **No fraud detection**: No monitoring for anomalous account behavior (e.g., multiple accounts from one IP, bot-like signup patterns).

---

## 6. Account deletion and data rights

### Implemented
- **`/api/account/delete` route**: Cascades deletion across 17 tables (`patient_notes`, `kate_insights`, `call_notes`, `call_scorecards`, `proposals`, `schedule_attempts`, `calendar_events`, `calendar_connections`, `portal_connections`, `portal_facts`, `integrations`, `provider_visits`, `providers`, `plaid_transactions`, `plaid_items`, `app_users`) plus the Supabase Auth user.
- **Audit trail of deletion**: Deletion event is logged to `audit_logs` before cascading.
- **Confirm-required**: Deletion requires `{ confirm: true }` body to prevent accidents.

### Gaps
- **VAPI call audio**: Deletion flow does not call VAPI's API to delete recordings and transcripts for the user. Residual PHI may remain at VAPI.
- **Plaid disconnect**: Deletion removes QBH's local records but does not call Plaid's item-remove endpoint to revoke QBH's access.
- **Google Calendar revocation**: Deletion does not explicitly revoke OAuth tokens held by QBH for the user's calendar.
- **Supabase backups**: Point-in-time backups will retain user data after account deletion per Supabase retention policy.
- **No data export / portability flow**: Users cannot download their data; may be required under CCPA, CMIA, and similar laws.

---

## 7. Third-party subprocessor posture

See `vendor-inventory.md` for full detail. Summary:

- Supabase, OpenAI, VAPI, Vercel: all offer BAAs. Current execution status to be confirmed.
- Twilio BAA is inherited through VAPI subprocessor chain; confirm scope.
- Google Workspace (Calendar) offers a BAA.
- Apple Push Notifications does not offer a BAA; must design around.
- Plaid is regulated under GLBA, not HIPAA; verify DPA.

---

## 8. Mobile application security

### Implemented
- **Capacitor native shell**: iOS and Android apps wrap the Next.js web application. Static export is bundled into the app; API routes remain on Vercel.
- **WKWebView isolation**: Standard iOS WebView sandbox applies.
- **TLS enforcement**: All traffic from native app uses HTTPS.

### Gaps
- **Local storage contents**: Capacitor apps may cache responses, tokens, or Plaid Link session data in local storage, IndexedDB, or the native Preferences plugin. Full audit of client-side caching not yet performed.
- **Certificate pinning**: Not implemented. Standard TLS without pinning.
- **Jailbreak / rooted device detection**: Not implemented.
- **App integrity attestation**: Not implemented (Apple DeviceCheck / Play Integrity).

---

## 9. Development and operational security

### Implemented
- **Secrets management**: Secrets stored in `.env.local` (dev) and Vercel environment variables (prod). Never committed to git.
- **Environment separation**: Separate VAPI assistant IDs for test vs. production (`VAPI_ASSISTANT_ID_TEST`, `USE_TEST_ASSISTANT`).
- **Code review workflow**: Git-based. (Confirm formal code review process.)

### Gaps
- **No Security Risk Assessment (SRA)**: Required under HIPAA Security Rule §164.308 for covered entities and business associates. Not yet performed.
- **No formal Incident Response Plan**: Breach notification procedures, escalation contacts, and communication templates are not documented.
- **No Business Continuity / Disaster Recovery plan**: Written plan does not exist.
- **No designated Privacy Officer or Security Officer**: HIPAA-required roles if classified as CE/BA.
- **No workforce HIPAA training**: Required annually if CE/BA.
- **No vendor due-diligence process**: New subprocessors are added ad hoc; formal vetting workflow not documented.
- **No SOC 2 audit** underway. Epic distribution may require SOC 2 Type I or II.
- **No HITRUST certification** — may be relevant depending on partner requirements.

---

## 10. Summary of recommended priorities

### Completed 2026-04-22
- ✅ Cookie consent management platform deployed (Cookiebot) with Google Consent Mode v2 Advanced and GPC honoring
- ✅ Google Analytics 4 reconfigured to service-provider-only mode (Data Processing Amendment accepted; Google Signals, ads personalization, granular location, and data sharing disabled; 2-month retention)
- ✅ Meta Pixel and session replay tools verified as not installed (and deliberately avoided going forward)
- ✅ Geolocation confirmed as not collected by the product (no `navigator.geolocation`, no Capacitor geolocation plugin, no iOS/Android location permissions declared)

### Before launch (P0)
1. Execute BAAs with Supabase, OpenAI, VAPI, Vercel
2. Publish real Terms of Service and Privacy Policy (replace `#` placeholders, also referenced by Cookiebot banner)
3. Split onboarding consent into separate, granular authorizations
4. Add explicit call-recording consent language for two-party-consent states
5. Confirm VAPI call-audio retention and deletion-on-request capability
6. Designate a Privacy Officer and Security Officer (if CE/BA)

### Within 30 days of launch (P1)
7. Perform formal Security Risk Assessment
8. Write Incident Response Plan, including breach-notification workflows
9. Extend `/api/account/delete` to revoke VAPI recordings and Plaid items
10. Implement data export / portability flow
11. Implement MFA for internal staff and user accounts (opt-in)
12. Publish full subprocessor list in Privacy Policy
13. Complete a marketing-copy audit and align claims to reality

### Within 90 days (P2)
14. Begin SOC 2 Type I preparation (especially if pursuing Epic distribution)
15. Implement application-level field encryption for highly sensitive fields (insurance member ID, DOB)
16. Increase `audit_logs` retention to comply with HIPAA 6-year requirement (if CE/BA)
17. Document formal code review, deployment, and vendor onboarding processes
18. Implement workforce privacy/security training (if CE/BA)
19. Procure cyber / privacy insurance

### Future (P3)
20. Certificate pinning, jailbreak detection, app attestation
21. Centralized log aggregation + SIEM
22. HITRUST certification (if partner-required)
