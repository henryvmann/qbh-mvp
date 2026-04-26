# Consolidated Counsel Notes — Privacy Policy Questionnaire

**Prepared for: Gunderson Dettmer Stough Villeneuve Franklin & Hachigian, LLP**
**Date: 2026-04-22**
**Company: Quarterback Health, Inc.**
**Primary contact: Henry (henry@getquarterback.com)**

This document consolidates the substantive notes, clarifications, and open questions we identified while completing Gunderson's Privacy Policy Questionnaire. Each questionnaire answer is followed by our reasoning and any counsel-facing notes. Cross-cutting issues appear at the end.

All GA4-reconfiguration activity referenced below was completed on 2026-04-22 and is documented in `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md`.

---

## Executive summary

### Threshold question (please answer first)

We believe our default regulatory classification is a direct-to-consumer Personal Health Records (PHR) vendor regulated primarily by the FTC Health Breach Notification Rule and state consumer-privacy laws. We further believe we will become a Business Associate to Epic-integrated hospital systems at the point where our Epic FHIR integration is activated, for the data flowing from those integrations only.

We request counsel's written confirmation (or correction) of this classification. Every downstream question depends on the answer.

### Top priority issues

1. Quarterback Health is a healthcare-adjacent consumer app. State health-specific privacy laws — particularly the Washington My Health My Data Act, Nevada's consumer health data law, California CMIA, Texas Medical Records Privacy Act, and the FTC Health Breach Notification Rule — apply alongside the 19 comprehensive state privacy laws listed in the questionnaire.

2. Our Terms of Service and Privacy Policy are currently unpublished; the in-product consent checkbox links to `#` placeholders.

3. Our onboarding consent checkbox bundles three authorizations (ToS acceptance, PHI-use authorization, AI-call authorization) into one input. This likely needs to be split.

4. Our AI voice agent places telephone calls to healthcare offices on behalf of users. Calls are recorded by default. Two-party consent states and AI-disclosure statutes apply.

5. BAAs are required and currently unexecuted with: Supabase, OpenAI, VAPI, Vercel. Plaid is regulated under GLBA; Google Calendar BAA is available through Google Workspace.

6. Marketing copy includes certain claims ("Bank-level security," "No data sold," "Your data stays private") that require counsel review to ensure defensibility.

7. We deliberately do not use Meta Pixel, session replay tools (Hotjar, Fullstory), or behavioral-advertising tracking, per counsel best practices for healthcare-adjacent apps.

---

## Part 1 — Questionnaire answers, with notes

### Q3 — Channels through which you collect personal data

Checked: Website (including cookies and tracking), Mobile app. Added an "Other" note:

> Telephone calls: we place outbound calls to healthcare offices on users' behalf via an AI voice agent (Kate); audio is recorded and transcribed.
>
> Third-party integrations authorized by the user: Plaid (bank transactions for provider discovery), Google Calendar (availability), and — in future — Epic FHIR (clinical records from hospital systems).

### Q4 — Technologies used on site or app

Checked: Chatbots (Kate chat assistant).

Deliberately not checked: Session Replay, Meta Pixel, Applications that play videos.

Note: We deliberately do not use Meta Pixel, and we do not use session replay tools (Hotjar, Fullstory, LogRocket, Mouseflow, Smartlook). We understand the elevated litigation risk associated with these tools in a healthcare-adjacent consumer context and have made an architectural decision to avoid them.

### Q5 — Use or combine personal data to make inferences

Answered: Yes. Description:

> Yes. We use automated processing (including large-language-model classifications) to: identify which of a user's bank or credit-card transactions are with healthcare providers, and classify each merchant as a specific provider type such as dentist, primary care, therapist, or pharmacy; infer whether a user is overdue for a given provider based on visit-history cadence; generate personalized daily insights (care gaps, upcoming-visit preparation, encouragement) based on the user's health data, stated focus areas, and proactivity preference; infer user intent during chat interactions with our AI assistant, Kate, and route accordingly (for example, search for providers, schedule, or answer); and classify completed phone calls (booked, voicemail, rescheduled, or failed) to drive retry and notification logic.

### Q6 — Sell personal data for money

Answered: No.

### Q7 — Disclose or sell for other benefit

Answered: No (answer reached after GA4 reconfiguration completed 2026-04-22). Description:

> No. Our only tracking technology is Google Analytics 4, which we have configured to operate as a service provider under an accepted Google Data Processing Amendment. We have disabled Google Signals, data sharing with Google products and services, ads personalization across all regions, and all advertising features. We have shortened data retention to the minimum two months and enabled Google Consent Mode v2 Advanced. Google Analytics 4 loads only after explicit user consent captured through our Cookiebot consent management platform. We do not use the Meta Pixel, retargeting tags, or any other tracking technology. All other third parties that receive personal data (Supabase, OpenAI, VAPI, Vercel, Plaid) are paid service providers operating under data processing or business associate agreements restricting their use of our data.

### Q8 — Automated processing for decisions in regulated areas

Checked: Health-care services. Description:

> We use automated processing (large-language-model based) to generate personalized healthcare coordination outputs for each user, including: daily insights identifying care gaps and overdue visits; AI-assisted scheduling recommendations; and an AI voice agent that, when explicitly authorized by the user for a specific provider call, schedules appointments on the user's behalf. We do not deny, restrict, or gatekeep access to any healthcare service based on this processing. The user remains in control of every action and all scheduling is initiated by the user.

Open question for counsel: whether this processing produces "legal or similarly significant effects" under Colorado, Virginia, Connecticut, and peer state privacy laws, triggering profiling-specific obligations.

### Q9 — Cookie banner

Answered: Yes, regardless of the user's location (Cookiebot deployed 2026-04-22). Screenshot of the banner provided separately.

### Q10 — Kinds of cookies placed

Checked: Essential (Supabase Auth, Plaid Link, Cookiebot's own consent cookie), Analytics (Google Analytics 4).

Not checked: Preference / Functional, Advertising / Retargeting.

### Q11 — DNT / GPC signals

Checked: Global Privacy Control (GPC) signals. Note:

> We implemented Cookiebot as our consent management platform. Cookiebot is configured to recognize and honor Global Privacy Control (GPC) signals for visitors in supported US jurisdictions. We do not honor Do-Not-Track (DNT) signals, as DNT has been effectively deprecated and is not a required compliance mechanism under any current state privacy law.

### Q12 — DAA Self-Regulatory Principles

Answered: No. Note:

> No. The DAA Self-Regulatory Principles govern companies that engage in online behavioral advertising. Quarterback Health does not engage in behavioral advertising: we do not serve advertisements on our site or app, we do not run retargeting campaigns, and we have not installed advertising pixels (including the Meta Pixel, which we expressly avoid). We are therefore not a participant in the DAA framework. Should we engage in advertising in the future, we would re-evaluate DAA compliance at that time.

### Q13 — EU/UK data collection

Answered: No. Note:

> No. We are building Quarterback Health for the United States market only. Our product is functionally restricted to the US: Plaid transaction discovery relies on US financial institutions, and our AI voice agent places calls to US phone numbers. Before launch, we will restrict iOS App Store and Google Play distribution to the United States, implement geographic gating on our website to prevent sign-ups from the European Union and United Kingdom, and configure Google Analytics 4 to exclude EU/UK traffic. We are not targeting, marketing to, or monitoring individuals in the EU or UK.

Skipped questions 14.1–14.6 per the instruction.

### Q14 — US states doing business in

Checked all 19 listed states (CA, CO, CT, DE, IN, IA, KY, MD, MN, MT, NE, NH, NJ, OR, RI, TN, TX, UT, VA). Note:

> We are pre-launch and currently have no active users in any state. The boxes above reflect our intended market — Quarterback Health will be available to residents of every US state once we launch on the Apple App Store, Google Play, and the web. Because we do not geographically restrict within the United States, we expect to be "doing business" in every state that has enacted or will enact a comprehensive consumer privacy law. We would appreciate guidance on which of these laws' thresholds we are likely to meet at launch versus at scale, so we can prioritize compliance work accordingly.

Additional health-specific state laws flagged:

> In addition to the comprehensive state privacy laws listed in Question 14, we understand the following sector-specific laws are likely to apply given our product's handling of consumer health data. We would appreciate your guidance on which apply and what obligations each imposes:
>
> Washington My Health My Data Act (MHMDA), which regulates consumer health data collection and imposes explicit consent and authorization requirements.
>
> Nevada SB 220 (Consumer Health Data Privacy Law), similar in scope to MHMDA.
>
> California Confidentiality of Medical Information Act (CMIA), which applies to certain providers of medical information services.
>
> New York SHIELD Act, which imposes data security requirements on companies handling personal information of NY residents.
>
> Texas Medical Records Privacy Act (TMRPA), which can apply more broadly than HIPAA.
>
> FTC Health Breach Notification Rule (updated 2024), which applies to vendors of personal health records and related entities.

### Q17 — Sell personal data (expanded definition)

Answered: No. (Reconfiguration record in `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md`.)

See full description under Q7.

### Q18 — Small business under SBA definition

Answered: Yes. Quarterback Health is a small business under the SBA standard (independent for-profit, far fewer than 500 employees).

### Q18.1 — Small business selling sensitive personal data

Answered: No. Because Q17 is No, Q18.1 is not applicable.

### Q19 — Nevada or Washington State business

Checked: Both NV and WA State. This is tied to flagging Washington MHMDA and Nevada SB 220 as particularly relevant health-data laws.

### Q19.1 — Consumer data linked to health status

Answered: Yes. Note:

> Yes. We collect data that is linked or reasonably linkable to individual consumers and that identifies their past, present, and future physical and mental health status. This includes the identity of the consumer's healthcare providers, the specialty of each provider, appointment and visit history, inferences about whether the consumer is overdue for routine care, medication information, and — once our Epic FHIR integration is active — clinical records such as problem lists, allergies, and visit summaries received directly from the consumer's healthcare providers.

### Q20 — Children's data

Checked: Collect personal data about children in the U.S. who are under the age of 13; sourced from the child's parent / legal guardian. Note:

> We collect health-related information about children in the United States who are under the age of 13 when an adult account holder (a parent or legal guardian) chooses to track healthcare for their child as part of managing family care. The data is provided to us by the parent or legal guardian, not directly by the child. The child does not create an account or interact with the product independently. We would appreciate guidance on COPPA applicability and any parental-consent documentation requirements we should implement in our onboarding flow before launch.

### Q20.1 — Targeted advertising from minors under 18

Answered: N/A. QBH does not engage in targeted advertising for any user, minor or adult.

### Q20.2 — Profiling minors under 18

Checked: minors who are under 18 years old. Note:

> When an adult account holder tracks healthcare for a child, our automated processing (including Kate insights about care gaps, overdue visits, and appointment suggestions) operates over that child's data as well as the adult's. We do not conduct profiling for advertising or behavioral targeting. The profiling is strictly for purposes of generating healthcare coordination outputs requested by the adult account holder on the child's behalf.

### Q21 — Financial incentives / loyalty programs

Answered: No. Note:

> No. Quarterback Health operates on a flat subscription pricing model. We do not offer points, rewards, discounts, or other benefits in exchange for ongoing participation or personal data collection. Should we implement a referral program in the future (for example, giving existing users a credit for referring new users), we would revisit whether this question applies and update our privacy notice accordingly.

---

## Part 2 — Collection, purpose, and data-category matrix

### Purposes of collection

Checked:

- Providing, Customizing and Improving the Services: all 8 sub-items
- Corresponding with You: Responding to correspondence; Sending emails per user preferences (transactional emails such as password reset and verification via Supabase Auth)

Not checked: Marketing the Services (not currently applicable — we don't send marketing emails or show advertisements).

### Data-category matrix

**Profile or Contact Data**: checked first and last name, email address, phone number. Purpose: Providing + Corresponding. Disclosed to: Service Providers.

**Identifiers (government IDs)**: not applicable. We do not collect SSN, driver's license, passport, state ID, or cultural identifiers.

**Payment Data**: not applicable today. Payment processing will launch with Stripe (web) and Apple IAP / Google Play Billing (mobile). Card data will be tokenized by those providers; we will not store full card numbers, bank account numbers, or security codes.

**Commercial Data**: checked purchase history (we analyze Plaid transactions for healthcare-merchant discovery) and consumer profiles (onboarding focus areas, care-recipient designations, Kate insights). Disclosed to: Service Providers.

**Device/IP Data**: checked IP address, device ID, type of device/OS/browser. Disclosed to: Service Providers (GA4 in service-provider mode, Vercel, Cookiebot, Supabase).

**Web Analytics**: checked web page interactions, referring webpage, non-identifiable request IDs, statistics, browsing/search history within the QBH app. Disclosed to: Service Providers (GA4 only).

**Social Network Data**: not applicable. We do not use social login. Google Calendar and Google Places are service integrations, not social networks.

**Consumer Demographic Data**: checked age / date of birth (collected for insurance verification during Kate calls). Not collected: zip code, gender, race, ethnicity, sex life or sexual orientation, political opinions, religious beliefs. Disclosed to: Service Providers (VAPI needs DOB to speak during calls).

**Professional or Employment-Related Data**: not applicable.

**Non-Public Education Data**: not applicable.

**Geolocation Data**: checked IP address-based location information only. Not collected: specific GPS or precise location data. Verified in code: no `navigator.geolocation`, no `@capacitor/geolocation` package, no iOS `NSLocationWhenInUseUsageDescription`, no Android location permissions. The urgent-care feature in our app uses the CMS NPI Registry text search; it does not request device location. Disclosed to: Service Providers.

**Biometric Data**: not collected. Note to counsel:

> QBH records telephone calls placed by Kate to healthcare offices. These recordings contain Kate's synthesized voice and office staff voices, but do not contain the QBH user's voice (the user is not on the call). We do not extract voiceprints or any biometric identifiers from these recordings. We would appreciate counsel's confirmation that this does not trigger biometric-data regulations (Illinois BIPA, Washington WBPA, Texas CUBI), and whether office-staff voice recording creates any biometric exposure distinct from the patient-consent recording question already flagged.

**Sensory Data**: not collected directly from users. Note to counsel:

> We record telephone calls placed by Kate to healthcare offices on our users' behalf. The recordings contain Kate's synthesized voice and office staff voices. Users may send text messages to our Kate chat assistant which are retained for session purposes. We do not record the user's voice or images directly. We would appreciate counsel's view on whether office-staff voice recording should be categorized as sensory data collected by us, or treated as incidental to the call-placement service we provide on the user's behalf.

**Health Data**: checked medical insurance information, mental health information (implied when users track therapists), medical conditions (inferred from provider specialties). Note:

> We collect health data both directly (insurance carrier and member ID, for purposes of scheduling appointments) and by inference (the specialty of a user's healthcare providers implicitly reveals health conditions — e.g., a user with a "cardiologist" on their provider list implies cardiovascular concern). When our Epic FHIR integration launches, we will also receive clinical records directly from covered entities, including problem lists, medications, allergies, and visit summaries.

Disclosed to: Service Providers (Supabase, OpenAI, VAPI, Vercel).

**Sensitive Data**: checked Health Data; Personal data collected from a known child under 13 years of age. Disclosed to: Service Providers.

**Inferences Drawn from Other Personal Data Collected**: Yes. Checked Providing. Disclosed to: Service Providers (OpenAI generates the inferences).

**Sensitive Data Inferences**: Health data (Kate insights infer care gaps, overdue care, and scheduling recommendations from health data); Personal data collected from a known child under 13 (same inference engine operates over child data when an adult tracks a child). Checked Providing. Disclosed to: Service Providers.

**Other Identifying Information that You Voluntarily Choose to Provide**: Identifying information in emails or letters from users (users may include PHI in support correspondence).

### Supplementary data-collection note

> Quarterback Health does not collect: government identification numbers (SSN, driver's license, passport, state ID), payment card numbers or full bank account details (to be tokenized via Stripe when payments launch), demographic categories beyond date of birth, professional or education records, biometric identifiers, or directly-recorded user photos, videos, or voice recordings.
>
> We do collect: basic profile (name, email, phone), healthcare provider data (names, specialties, phone numbers), appointment history, insurance carrier and member ID, date of birth, transaction-based purchase history (via Plaid) for provider discovery, device and browser metadata, web analytics via Google Analytics 4 (configured in service-provider mode), Kate chat messages, and audio recordings of telephone calls placed by Kate on our users' behalf (user is not on these calls — recordings contain Kate's synthesized voice and healthcare office staff voices).
>
> By inference we hold: health conditions implied by provider specialty, mental health status implied by therapist on provider list, overdue care inferences generated by Kate, and geographic location inferred from IP.
>
> When Epic FHIR integration launches, we will additionally hold clinical records received directly from covered healthcare entities.
>
> All disclosures of personal data are to Service Providers (Supabase, OpenAI, VAPI, Vercel, Google Analytics in service-provider mode, Google Workspace for Calendar access, Plaid, Cookiebot) operating under data processing or business associate agreements. We do not disclose personal data to Advertising Partners, Business Partners, or Parties Users Authorize (e.g., social networks) — none of these categories apply to our product.

---

## Part 3 — Sources, disclosures, and retention

### Sources of personal data

- Directly from the user: information the user provides; cookies and analytics placed on our site.
- From public records: records from the government (CMS National Provider Identifier Registry).
- From third parties: Plaid Inc. (financial data aggregator); Epic Systems Corp. and affiliated hospital systems (post-Epic-integration, for clinical records).

Note:

> Plaid Inc. — financial data aggregator. Users authenticate their bank account via Plaid Link (a widget hosted by Plaid). With the user's explicit consent, Plaid returns up to 12 months of transaction data (merchant names, dates, amounts, Plaid category tags) to Quarterback Health, which we use solely to identify healthcare-related merchants for provider-discovery purposes.
>
> Epic Systems Corp. and affiliated healthcare provider organizations — once our Epic FHIR integration is active, Epic will transmit clinical records (problem lists, medications, allergies, appointments, visit summaries) from the user's healthcare provider(s) to Quarterback Health, with the user's explicit OAuth consent at the point of connection.

### Disclosure — Service Providers

Checked: Hosting/technology/communication providers; Security and fraud prevention consultants; Analytics providers; Support and customer service vendors; Product fulfillment and delivery providers (note: marginal fit — we do not ship physical goods; may be better interpreted as "service delivery"). Added "Other": voice communications and telephony infrastructure (VAPI and its subprocessor Twilio).

### Disclosure — Payment processors

Not checked today. Note:

> Payment processing has not yet launched. When launched, we plan to use Stripe, Inc. as our payment processor for web-based subscriptions, and Apple In-App Purchase / Google Play Billing for mobile-based subscriptions.

### Disclosure — Advertising Partners

Not checked. We do not share with ad networks, data brokers, or marketing providers. This is consistent with our Q17 No answer and our deliberate avoidance of Meta Pixel and retargeting.

### Disclosure — Business Partners

Not checked at this time.

### Disclosure — Parties that Users Authorize, Access, or Authenticate

Not checked. Note flagged for counsel characterization:

> When a user authorizes our AI voice agent to schedule an appointment on their behalf, our agent discloses patient information (name, date of birth, insurance carrier and member ID, callback phone, reason for visit) to the receiving healthcare office during the call. This is a user-directed disclosure to a covered entity at the user's request, not a disclosure to a commercial third-party recipient. We would appreciate counsel's view on how to characterize this in our privacy notice.

### Retention

Checked all three sample statements. Added "Other":

> Additional retention practices specific to Quarterback Health:
>
> Healthcare provider records, appointment history, and visit notes are retained for as long as the user has an account with us. Users may delete individual records through the product UI.
>
> Kate AI chat session history is not persisted server-side beyond the active session.
>
> Daily Kate "insights" are cached for up to 24 hours and regenerated or dismissed.
>
> Telephone call recordings and transcripts generated by our AI voice agent are retained per the retention policy of our voice infrastructure provider (VAPI). We are confirming the specific retention period and will update this practice once confirmed.
>
> Google Analytics 4 event and user data is retained for two months, the shortest retention period offered by Google, and is then automatically deleted by Google.
>
> Audit logs recording sensitive actions are retained for the duration of the user's account and are deleted upon account deletion. Should Quarterback Health be classified as a HIPAA Covered Entity or Business Associate, we will extend audit log retention to six years as required by the HIPAA Security Rule.
>
> Upon user-initiated account deletion, we cascade-delete user data across our 17 data tables and the Supabase authentication record. We acknowledge residual exposure in (a) our provider's point-in-time database backups, (b) VAPI-retained call recordings, and (c) our subprocessors' operational logs, and will work with counsel to structure a compliant deletion protocol covering these residual data sets.

---

## Part 4 — Cross-cutting issues and open questions

Issues we surfaced that sit across multiple questionnaire sections and warrant counsel guidance.

### 4.1 Regulatory classification

We request counsel's written determination: Covered Entity, Business Associate, or direct-to-consumer PHR? Our working assumption is PHR with Business-Associate scope for Epic-sourced data. Please confirm or correct.

### 4.2 Consent-flow remediation

Current onboarding uses a single checkbox that bundles (a) Terms of Service acceptance, (b) Privacy Policy acceptance, and (c) authorization to place AI-assisted phone calls and to use personal information to organize care. The "Terms of Service" and "Privacy Policy" links point to `#` placeholders.

We need counsel's guidance on:
- Whether consents must be separated into distinct checkboxes.
- Whether the AI voice call authorization must be a standalone HIPAA §164.508 authorization (if applicable).
- What recording-consent language is needed to satisfy two-party consent states (CA, FL, IL, MA, MD, MT, NH, PA, WA).
- Whether Kate must proactively disclose her AI status at call open under CA SB 1001, Colorado AI Act, or FTC guidance.
- Whether care-recipient-data handling (partner, aging parent, child) requires distinct consents from the user as personal representative.

### 4.3 Subprocessor agreements

Required and currently unexecuted:
- Supabase BAA (requires Team or higher plan)
- OpenAI BAA (requires zero-retention enterprise agreement)
- VAPI BAA (includes verification of Twilio subprocessor coverage)
- Vercel BAA (requires Enterprise tier)
- Google Workspace BAA (for Calendar access)

Executed or in good shape:
- Google Analytics 4 Data Processing Amendment (accepted April 2, 2026; GA4 reconfigured for service-provider-only operation 2026-04-22 — see compliance record)
- Plaid DPA (under GLBA framework; to confirm execution status)

Not offered:
- Apple Push Notifications (Apple does not offer a BAA; we will need to send generic payloads rather than PHI in notifications).

### 4.4 Voice-call recording

VAPI records calls by default. We will confirm VAPI's retention period, encryption, and deletion-on-request capability before launch. We need counsel's advice on:
- Whether recording is permissible in two-party consent states under the user's authorization only, or whether receptionist verbal consent is required.
- Whether Kate should proactively disclose recording at call open.
- Whether recording should be disabled by default in certain states.

### 4.5 Data deletion completeness

Our in-app account deletion cascade-deletes user data across 17 tables plus Supabase Auth. Gaps we acknowledge:
- Point-in-time database backups (Supabase retention policy).
- VAPI call recordings.
- Plaid item revocation (we remove our local record but don't currently call Plaid's item-remove endpoint).
- Google Calendar OAuth token revocation.

We request counsel's guidance on what deletion completeness is required under state privacy laws and, if applicable, HIPAA §164.502.

### 4.6 Marketing-copy claims

Flagged marketing claims requiring counsel review:

- "Bank-level security" (onboarding trust-point): consider replacing with specific, accurate language (TLS 1.2+ in transit, AES-256 at rest).
- "No data sold" (onboarding trust-point): must align with final privacy policy and the expansive state-law definitions of sale.
- "Your data stays private" (portal-connect, calendar-connect, handle-first): consider qualifying given that subprocessors (OpenAI, Supabase, VAPI) process this data.
- "Securely" (Plaid OAuth flow): consider removing or replacing with specific language.
- "QBH only reads what you authorize" (portal-connect): consider clarification.

Full audit in `docs/legal/marketing-copy-audit.md`.

### 4.7 Incident response and risk assessment

Not yet in place, likely required if classified as Covered Entity or Business Associate:
- Written Incident Response Plan with breach-notification workflows.
- Security Risk Assessment under HIPAA Security Rule §164.308.
- Designated Privacy Officer and Security Officer.
- Workforce privacy/security training.
- Business Continuity / Disaster Recovery plan.

Also not yet in place and relevant to Epic App Market distribution:
- SOC 2 Type I or Type II examination.
- HITRUST certification (if partner-required).

### 4.8 Small-business exemption, Texas TDPSA sensitive data

Because we answered Q17 as No, the Texas TDPSA prior-consent-for-sensitive-data-sale requirement does not trigger. If our Q17 classification changes, the Cookiebot consent mechanism (which captures affirmative opt-in for analytics cookies) would likely satisfy TDPSA. We would appreciate counsel's confirmation.

### 4.9 Children's data — COPPA

We collect health information about children under 13 when an adult (parent/legal guardian) manages their healthcare through our product. We request counsel's guidance on:
- Whether our parental-consent mechanism is sufficient.
- Whether we need distinct COPPA-compliant parental-consent language in onboarding.
- Whether Kate's insights about a child's care meet COPPA's definition of profiling a child.
- How to handle data-access-and-deletion requests from children (or from parents on behalf of children) under state laws.

### 4.10 Epic / FHIR distribution

Not directly a questionnaire item, but relevant to our privacy-notice scope: we will become a Business Associate to Epic-integrated healthcare systems at the point we activate Epic FHIR integration. We request counsel's advice on:
- The required agreement structure (App Market submission, SOC 2 expectations, written BAAs with each hospital).
- Whether Epic-sourced clinical records require distinct retention and deletion practices from user-provided data.
- Whether our privacy notice must distinguish between data we are controller of and data we receive as business associate.

### 4.11 iOS / Android distribution

Before launch we will:
- Restrict iOS App Store availability to the United States.
- Restrict Google Play availability to the United States.
- Implement geographic gating on our web sign-up flow.
- Configure Google Analytics 4 to exclude EU/UK traffic.

We request counsel's guidance on Apple's privacy nutrition labels for our app, and whether our current copy accurately describes data-collection practices at the granularity Apple requires.

### 4.12 Cookiebot implementation evidence

Full record of the GA4 / Cookiebot reconfiguration performed 2026-04-22 is available in `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md`, including the Change ID, signed audit entry, and evidence retention plan for future SOC 2 examinations.

---

## Part 5 — What we are asking of counsel

In priority order:

1. Written classification memo (CE / BA / PHR).
2. State-law applicability matrix — comprehensive privacy laws (the 19) plus sector-specific health laws (WA MHMDA, NV SB 220, CA CMIA, TX TMRPA, NY SHIELD, FTC Health Breach Notification Rule).
3. Terms of Service (draft or review) suitable for launch.
4. Privacy Policy (draft or review) aligned with this questionnaire, the data-collection matrix, and marketing claims.
5. Revised consent-flow language — separate authorizations, recording consent, AI disclosure, care-recipient authority.
6. BAA / DPA review and execution roadmap with Supabase, OpenAI, VAPI, Vercel, Google Workspace.
7. Incident Response Plan template tailored to our data and breach-notification obligations.
8. Epic distribution prerequisites — legal agreements, security certifications, privacy-notice treatment.
9. Engagement structure — preferably flat-fee on deliverables where possible, with modest hourly retainer for ongoing advisory.

---

## Part 6 — Supporting documents

The following are in the repository under `docs/`:

- `docs/legal/summary-for-counsel.md` — one-page executive summary
- `docs/legal/data-flow-diagram.md` — data flow diagram and narrative
- `docs/legal/vendor-inventory.md` — subprocessor inventory with BAA status
- `docs/legal/security-measures.md` — security controls, gaps, priorities
- `docs/legal/consent-flow.md` — consent UI walkthrough with source references
- `docs/legal/marketing-copy-audit.md` — marketing claim audit
- `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md` — dated compliance change record
- `docs/compliance/README.md` — compliance change log policy

We would be grateful if counsel would review these alongside the completed questionnaires.

---

*End of consolidated counsel notes.*
