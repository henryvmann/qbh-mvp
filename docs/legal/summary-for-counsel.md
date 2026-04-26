# Quarterback Health — Summary for Outside Counsel

**Date: 2026-04-22**
**Purpose: brief counsel on scope, posture, and priorities ahead of first engagement meeting**

---

## Company and product

**Quarterback Health, Inc.** is a consumer-facing healthcare management application.

Core functionality:
1. Discovers the user's healthcare providers automatically by analyzing bank/credit-card transactions (via Plaid), classifying merchants with an AI model, and cross-referencing the CMS NPI Registry.
2. Tracks providers, appointments, care gaps, and medications.
3. Authorizes an AI voice agent ("Kate") to place outbound phone calls to healthcare offices on the user's behalf to schedule appointments.

The product is available as a web application and as native iOS and Android applications (Capacitor wrappers of the same web codebase). Epic FHIR integration is in development but not yet active.

---

## Threshold question for counsel

Is Quarterback Health:

- a HIPAA **covered entity**,
- a HIPAA **business associate** (and if so, to which entities and for which data flows),
- or a **direct-to-consumer personal health records (PHR) app** regulated primarily by the FTC and state privacy laws?

This classification drives everything else. We believe the default posture is PHR / FTC, with a business-associate relationship arising at the point we integrate with Epic. We want counsel's confirmation and guidance on how to structure marketing, policies, and subprocessor contracts accordingly.

---

## What we've prepared for this meeting

Six accompanying documents, in order of importance:

1. **`data-flow-diagram.md`** — visual and narrative map of every data flow and third party.
2. **`vendor-inventory.md`** — every subprocessor, what data they receive, BAA/DPA status, priority.
3. **`security-measures.md`** — inventory of current technical and administrative controls, gaps, and recommended remediation schedule.
4. **`consent-flow.md`** — walkthrough of the onboarding consent UI (and new Cookiebot cookie consent surface) with source references and issues to surface.
5. **`marketing-copy-audit.md`** — every security, privacy, or regulatory claim in the product, with location and commentary.
6. **`counsel-notes-consolidated.md`** — consolidated response notes for each question in the privacy policy questionnaire, plus the cross-cutting issues we want counsel to weigh in on.

Supporting compliance evidence: `docs/compliance/2026-04-22-ga4-cookiebot-reconfiguration.md` — dated change record documenting the Google Analytics 4 and Cookiebot reconfiguration performed 2026-04-22 to move GA4 to service-provider-only mode.

---

## Already resolved (as of 2026-04-22)

The following items have been completed and do not require counsel action, though we would appreciate confirmation that our approach is adequate:

- **Cookie consent management platform deployed** — Cookiebot (Cybot A/S) is live with Google Consent Mode v2 Advanced and Global Privacy Control signal honoring.
- **Google Analytics 4 reconfigured to service-provider-only mode** — Data Processing Amendment accepted (April 2, 2026); data sharing with Google products, Google Signals, granular location/device collection, and ads personalization disabled; retention shortened to 2 months. Full evidence in the compliance record referenced above.
- **No advertising-tracking technologies installed** — We have deliberately not deployed Meta Pixel, retargeting pixels, or session replay tools (Hotjar, Fullstory, LogRocket). We understand the elevated litigation risk associated with these tools in healthcare-adjacent consumer apps.
- **Geolocation verified as not collected** — The product does not request device GPS. Urgent-care discovery uses the CMS NPI Registry text search, not location APIs.

## Priority issues for this meeting

### Issues requiring legal guidance before launch

1. **Classification.** CE, BA, or PHR — defines the entire compliance posture.
2. **Published Terms of Service and Privacy Policy.** Neither exists today; consent links (both in-product and in the Cookiebot banner) are placeholders.
3. **Consent-flow remediation.** The single bundled onboarding consent checkbox may not meet HIPAA §164.508 specification (if applicable) and is weak under best practice.
4. **Subprocessor agreements.** BAAs required with Supabase, OpenAI, VAPI, and Vercel. Twilio via VAPI chain. Plaid under GLBA.
5. **Two-party consent-state exposure** on recorded voice calls (CA, FL, IL, MA, MD, MT, NH, PA, WA).
6. **AI disclosure** requirements (CA SB 1001, Colorado AI Act, general FTC guidance).
7. **Apple App Store and Google Play submission compliance** — specifically privacy nutrition labels and delete-account requirement (implemented; see §6 of security-measures.md).
8. **State health-privacy laws** — Washington MHMDA, Nevada SB 220, California CMIA + CCPA/CPRA, Colorado Privacy Act, Texas Medical Records Privacy Act, New York SHIELD Act, FTC Health Breach Notification Rule (updated 2024).

### Issues for follow-up

9. **Epic App Market / App Orchard** distribution — likely requires SOC 2 and a written agreement structure with each hospital.
10. **Care-recipient (partner / child / parent) data** — authority to act on behalf of another adult, COPPA for minors.
11. **Data retention conflict** — current deletion flow removes audit logs immediately; HIPAA would require 6-year retention if CE/BA.
12. **Incident Response Plan and Security Risk Assessment** — required if CE/BA; advisable regardless.
13. **Cyber / E&O / D&O insurance** posture.
14. **Trademark** — "Quarterback Health," "QB," "Kate," logos.
15. **IP assignment** from prior contractors.
16. **Payment processing compliance** — when Stripe is launched; Apple and Google in-app purchase requirements for mobile subscriptions.

---

## What we want from this engagement

In priority order:

1. **Classification memo** and corresponding regulatory road-map.
2. **Terms of Service and Privacy Policy** suitable for launch, aligned to marketing claims and subprocessor practices.
3. **Revised consent-flow language and structure**, including separate authorizations, recording consent, and AI disclosure.
4. **BAA / DPA review and execution** with the Tier-1 subprocessors.
5. **State-law compliance matrix** so we can see our actual multi-jurisdictional obligations rather than a generic HIPAA checklist.
6. **Incident Response Plan template** tailored to QBH's data and breach-notification obligations.
7. **Epic distribution checklist** — what legal and security artifacts are prerequisites.

We would prefer **scoped flat-fee engagement** on deliverables where possible, with a modest hourly retainer for ongoing advisory.

---

## Timeline context

- App Store submission planned within ~4 weeks (contingent on Apple Developer enrollment currently underway).
- Public launch target: within 8 weeks.
- Epic integration: active development; distribution blocker to be determined.
- First paying customers likely within 3–6 months post-launch.

Deliverables needed in order of urgency:
- Classification memo — within 1 week
- Terms / Privacy Policy / consent revisions — before launch (~6 weeks)
- Subprocessor BAAs — before launch
- Full compliance road-map — within 30 days
