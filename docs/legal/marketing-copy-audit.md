# Quarterback Health — Marketing Copy Audit

**Prepared for: outside counsel review**
**Date: 2026-04-22**

This audit enumerates every instance in the current production code where marketing, onboarding, or user-facing copy makes a security, privacy, or regulatory claim. For each, the source file, line, literal text, and commentary are provided so counsel can bless, qualify, or flag the claim.

---

## 1. Summary of claims found

| Claim category | Count | Locations |
|---|---|---|
| "Bank-level security" | 1 | Onboarding |
| "Read-only access" / "strictly read-only" | 4 | Onboarding, calendar, portal, test |
| "No data sold" | 1 | Onboarding |
| "Your data stays private" | 3 | Portal-connect, calendar-connect, handle-first |
| "securely" / "secure" | 4 | Onboarding, Plaid OAuth |
| "QBH only reads what you authorize" | 1 | Portal-connect |
| "without losing control of privacy" | 1 | Caregivers page |
| **"HIPAA" / "HIPAA-compliant"** | **0** | **(not present in user-facing copy — good)** |
| "encrypted" | 0 | (not present) |

No instance of "HIPAA-compliant," "HIPAA-certified," or "encrypted end-to-end" was found in user-facing copy. This is good — such claims are high-risk and regulated.

---

## 2. Claims requiring counsel review

### 2.1 "Bank-level security"

- **Location**: `src/app/onboarding/page.tsx:1868` — trust-points block on signup page.
- **Literal text**: `Bank-level security`
- **Context**: Displayed as one of three trust-indicators with a circular icon.

**Commentary for counsel**:

"Bank-level security" is a widely used marketing phrase but has no fixed regulatory definition. Plaid and similar financial-data aggregators use the phrase to refer to 256-bit AES encryption and TLS, which QBH's underlying stack does provide via Supabase and Vercel. However:

- The claim suggests QBH meets or exceeds the security posture of a regulated financial institution. QBH is not itself a financial institution.
- Federal regulators (FTC) and state AGs have taken action against companies whose "bank-level security" claims did not match their actual practices.
- Consider whether to qualify the phrase ("uses bank-level encryption in transit and at rest") or replace with specific, accurate language ("encrypted in transit with TLS 1.2+ and at rest with AES-256").

### 2.2 "No data sold"

- **Location**: `src/app/onboarding/page.tsx:1870`
- **Literal text**: `No data sold`

**Commentary for counsel**:

This is a binding promise. Under multiple state privacy laws (CCPA/CPRA "do not sell or share" provision, Washington MHMDA, Colorado Privacy Act), the definition of "sale" is broader than cash exchanges and can include:

- Sharing data with third-party advertisers in exchange for services
- Analytics providers that receive identifiable data
- Any exchange of personal information for "monetary or other valuable consideration"

Before committing to "No data sold" in marketing, confirm the Privacy Policy will not list any disclosures that meet the statutory definition of a sale. The claim and the policy must match.

### 2.3 "Read-only access" / "strictly read-only" (Plaid)

- **Locations**:
  - `src/app/onboarding/page.tsx:858` — `Using Plaid, we'll securely identify healthcare co-pays from your past transactions to find your providers. Access is read-only.`
  - `src/app/onboarding/page.tsx:1213` — `Then we'll use Plaid to securely identify your healthcare providers from past co-pays. Access is strictly read-only.`
  - `src/app/onboarding/page.tsx:1869` — trust-point `Read-only access`
  - `src/app/api/discovery/test-classify/route.ts:9` — developer code comment (not user-facing)

**Commentary for counsel**:

Plaid provides read-only access to transaction data — the claim is accurate. However:

- "Read-only" to Plaid does not mean Plaid itself does not use the data under its own terms. Plaid's Privacy Policy governs Plaid's use; the user should be linked to it.
- "Read-only" does not mean data does not leave QBH. QBH sends merchant names to OpenAI for classification. This data flow should be disclosed.
- Confirm that QBH is not also using Plaid's `auth` or `balance` products, which provide different access types and would undermine the pure "read-only" framing.

### 2.4 "Securely" / "secure" (Plaid connection flow)

- **Locations**:
  - `src/app/onboarding/page.tsx:858, 1212`
  - `src/app/plaid/oauth/page.tsx:160` — `We're securely completing your bank connection.`
  - `src/app/plaid/oauth/page.tsx:165` — `Resuming secure sign-in...`

**Commentary for counsel**:

"Securely" is vague. The FTC has challenged similar generic security language when the underlying practices were deficient. Consider either:

- Replacing with specific accurate language (e.g., "connection handled by Plaid with 256-bit encryption"), or
- Removing the adverb and letting the Plaid flow speak for itself.

### 2.5 "Your data stays private"

- **Locations**:
  - `src/app/portal-connect/page.tsx:147` — `Your data stays private. QBH only reads what you authorize`
  - `src/app/calendar-connect/page.tsx:194` — `Read-only access · Your data stays private`
  - `src/app/handle-first/page.tsx:804` — `…suggesting appointment times. Your calendar data stays private`

**Commentary for counsel**:

"Stays private" is a strong claim that should match Privacy Policy commitments. Specifically:

- Calendar data is sent to OpenAI when building user context for Kate chat and insights. This contradicts a literal "stays private" reading.
- The phrase is plainly understood by a consumer to mean "no one else sees this." If any subprocessor processes this data (OpenAI, Vercel logs, VAPI transcripts), the claim is potentially misleading under FTC Section 5.

Consider qualifying or replacing with: "We only use your calendar to check for conflicts; it's never shared with advertisers."

### 2.6 "QBH only reads what you authorize"

- **Location**: `src/app/portal-connect/page.tsx:147`

**Commentary for counsel**:

Accurate in the sense that QBH only reads what the user grants via OAuth. However, "authorize" in this context means the OAuth scope granted at connect time — not a per-item consent. If the user expects "QBH asks me before each read," the claim is misleading. Recommend clarification.

### 2.7 "Without losing control of privacy" (caregivers page, "coming soon")

- **Location**: `src/app/caregivers/page.tsx:120` — `We are building caregiver tools so trusted people can help manage health without losing control of privacy.`

**Commentary for counsel**:

Forward-looking claim for a feature not yet implemented. Low immediate risk, but the claim will need to match the final caregiver-data-sharing design. Caregiver access to managed-person PHI raises HIPAA personal-representative questions (see consent-flow.md §3.5).

---

## 3. Claims that are accurate and low-risk

The following claims are factually correct as implemented and present no material risk absent a context change:

- "Using Plaid" (attribution of the data aggregation service)
- "Find your providers" (accurate description of feature)
- "On behalf of the user" language in Kate voice-agent prompt

---

## 4. Claims not present in code but anticipated in future copy

Based on common marketing patterns in this category, counsel should be prepared to advise on whether the following claims are defensible once made:

- "HIPAA-compliant" — **do not use** unless QBH is formally classified as a covered entity or business associate and has the controls to back it.
- "End-to-end encrypted" — **do not use** unless true. Data is decrypted server-side for processing; current architecture is not end-to-end encrypted.
- "Zero-knowledge" — **do not use** — QBH processes plaintext PHI server-side.
- "Medical-grade" / "clinical-grade" — unregulated but easily challenged; define carefully if used.
- "FDA-approved" — **do not use** — QBH is not an FDA-regulated medical device.
- "Doctor-recommended" — **do not use** unless backed by a defensible endorsement program.
- "SOC 2 compliant" — **do not use** until audit certificate is received.

---

## 5. Summary of recommended actions

| # | Claim | Recommended action | Priority |
|---|---|---|---|
| 1 | "Bank-level security" (onboarding trust point) | Replace with specific, accurate encryption language | P1 |
| 2 | "No data sold" (onboarding trust point) | Keep if Privacy Policy aligns; verify no subprocessor relationships meet state-law "sale" definition | P0 |
| 3 | "Read-only access" (Plaid) | Keep; ensure linked Privacy Policy explains subsequent use | P1 |
| 4 | "Securely" (Plaid OAuth flow) | Replace with specific language or remove | P2 |
| 5 | "Your data stays private" (portal, calendar, handle-first) | Reframe — add "We use your data only to provide the service; we don't share with advertisers" style qualification | P1 |
| 6 | "QBH only reads what you authorize" | Keep with clarifying copy | P2 |
| 7 | "Without losing control of privacy" (caregivers) | Revisit when feature ships | P3 |

All claim changes should be reviewed by counsel before publication. The Privacy Policy, once drafted, must align with every claim in this audit.
