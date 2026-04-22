# Quarterback Health — Consent Flow Walkthrough

**Prepared for: outside counsel review**
**Date: 2026-04-22**

This document walks through every consent, authorization, and data-sharing notice the user encounters during account creation and product use. Source references (file + line) are provided so counsel can verify against the current build.

---

## 1. Location of consent in the flow

Consent is collected at **account creation**, which occurs in step 7 of the onboarding flow in `src/app/onboarding/page.tsx`. The same consent checkbox also appears on the manual-providers path (step 6 variant). Until the user checks this box and meets other field requirements, the "Continue" button is disabled.

---

## 2. Current consent UI

### Location
`src/app/onboarding/page.tsx` — lines 1296–1317 (primary signup path) and 1154–1175 (manual-provider path).

### What the user sees

A single labeled checkbox with the following text (exact copy from the product):

> I agree to the **Terms of Service** and **Privacy Policy**, and authorize QB to call offices and use my info to organize my care.

The words "Terms of Service" and "Privacy Policy" are styled as hyperlinks.

### Technical state

Three internal boolean flags are set together when the user checks the box:

```
consentCalls  — authorizes QB to place phone calls on user's behalf
consentPhi    — authorizes use of personal / health info for service
consentTerms  — agreement to ToS and Privacy Policy
```

All three flags flip to true simultaneously; they cannot be granted or withheld individually in the current UI.

### Where consent state is recorded

On signup completion, consent is written to the server at `POST /api/auth/signup` (routed to `/api/onboarding` or similar) with a payload containing:

```
consents: {
  calls: true,
  phi: true,
  terms: true,
  consented_at: <ISO timestamp>
}
```

This is persisted on the `app_users` record. The user's IP address is not captured in the consent record (audit log captures IP separately for some actions).

---

## 3. Issues to surface with counsel

### 3.1 Policy documents are not published

The hyperlinks for "Terms of Service" and "Privacy Policy" in the consent UI point to `href="#"` placeholders. No policy documents currently exist at those anchors. Any user checking the consent box is not, in fact, receiving the terms they are agreeing to.

This is the most urgent consent-flow gap. Until real policies are published and linked, the consent box is arguably unenforceable.

### 3.2 Bundled consent

The checkbox combines three distinct authorizations:

1. **Contractual consent** to the Terms of Service
2. **Privacy consent** to data practices described in the Privacy Policy
3. **Service-specific authorization** to place phone calls and to use personal/health information

Best practice (and, in some regimes, legal requirement) is to separate these into distinct, granular consents. Bundled consents are weaker in enforceability and are flagged under several state privacy laws.

### 3.3 Call-recording consent

The authorization does not specifically state that phone calls placed by Kate are recorded. In two-party-consent states (California, Florida, Illinois, Massachusetts, Maryland, Montana, New Hampshire, Pennsylvania, Washington), recording a call without the consent of all parties — including the receptionist at the office — creates exposure.

Relevant design questions for counsel:

- Is the user (patient) the only party required to consent under an "on behalf of the patient" framing, or must the receptionist also be notified?
- Should Kate proactively disclose recording at call open ("This call may be recorded")?
- Should the recording consent be a separate, explicit sub-consent?

### 3.4 AI disclosure

Kate's voice-agent system prompt (`docs/vapi-assistant-prompt.md`) instructs her to disclose she is an AI assistant **if directly asked by the office**. She does not proactively disclose.

Relevant regulatory hooks:

- **California SB 1001** (Bot Disclosure Law): requires disclosure in certain contexts where a bot is used to influence commercial transactions or voting.
- **Colorado AI Act** (effective Feb 2026): imposes obligations on deployers of high-risk AI systems, including disclosure.
- **Federal Trade Commission** guidance on deceptive practices disfavors non-disclosure of AI in consumer interactions.

Recommendation to ask counsel: is reactive disclosure sufficient, or should Kate proactively identify at call open?

### 3.5 Consent for care-recipient data (minors / elders)

QBH supports tracking care for the user's partner, children, and parents. The current consent checkbox authorizes QBH to use "my info" — it does not address:

- **Authority to consent on behalf of another adult** (e.g., aging parent). HIPAA has specific rules for personal representatives.
- **Children's data** (COPPA). If under-13 data is collected, parental consent requirements apply.
- **Disclosure to family members** of a managed individual's health data.

### 3.6 No explicit consent for AI processing of PHI

The checkbox authorizes QBH to "use my info to organize my care," which may or may not be sufficient disclosure that:

- Messages, appointment context, and call transcripts are sent to OpenAI for processing by large language models.
- Transaction names are sent to OpenAI for classification.
- Call audio is processed by VAPI (with its LLM / STT / TTS subprocessors).

Consider an explicit AI-processing consent or at least a disclosed data-use statement in the Privacy Policy.

### 3.7 No mechanism to withdraw individual consents

Today, the only way for a user to withdraw consent is to delete their account entirely. There is no UI to revoke AI-call authorization while retaining the account, revoke Plaid access, or revoke individual sub-consents.

### 3.8 Missing standalone authorizations

If QBH is classified as a covered entity or business associate, HIPAA §164.508 requires specific authorization forms for:

- Disclosure of PHI for purposes other than treatment, payment, or operations.
- Disclosure of psychotherapy notes (N/A for current data).
- Use of PHI for marketing or research.

These authorizations must meet the §164.508 form requirements — plain-language, specific, time-limited, signed, revocable. The current onboarding checkbox does not meet that specification.

---

## 4. Consent events throughout product use

Consent is not re-presented or re-acknowledged during the following events:

- **Placing a phone call via Kate**: the user taps "Book" or "Handle it," which initiates an outbound call. No consent re-confirmation is shown ("You are about to authorize a phone call on your behalf — continue?").
- **Connecting Plaid**: handled by Plaid Link, which presents Plaid's own consent flow. QBH relies on Plaid's consent capture for the bank connection step.
- **Connecting Google Calendar**: handled by Google's OAuth flow.
- **Adding a care recipient**: the user enters information about another person without a distinct "I have authority to share this person's data" attestation.
- **Sharing data with OpenAI, VAPI, etc.**: not re-disclosed at the point each subprocessor receives data.

Recommendation to ask counsel: which of these events, if any, warrant an in-product disclosure or per-action authorization?

---

## 5. Consent-to-recording: office-side

Kate places outbound calls to healthcare offices. The person on the receiving end is a receptionist or scheduler — not a party who has consented to QBH's terms.

In two-party-consent states, the receptionist's consent to recording is required if the call is being recorded. VAPI calls are recorded by default.

Counsel should advise on:

- Whether a verbal disclosure at call open ("Hi, this is Kate calling on behalf of Jane Doe — this call may be recorded for quality and scheduling purposes") is sufficient.
- Whether recording should be disabled by default in two-party-consent states and only enabled after verbal acknowledgement.
- Whether the office's own notice ("this call may be monitored or recorded for quality") on their side counts toward consent.

---

## 6. Screenshots / source excerpts

### 6.1 Consent checkbox (signup path, lines 1296–1317)

```
<div className="mt-5">
  <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-[#EBEDF0] bg-white p-3">
    <input
      type="checkbox"
      checked={consentCalls && consentPhi && consentTerms}
      onChange={(e) => {
        setConsentCalls(e.target.checked);
        setConsentPhi(e.target.checked);
        setConsentTerms(e.target.checked);
      }}
      …
    />
    <span>
      I agree to the <a href="#">Terms of Service</a> and
      <a href="#">Privacy Policy</a>, and authorize QB to call offices and
      use my info to organize my care
    </span>
  </label>
</div>
```

### 6.2 Consent persistence (step-7 signup handler)

```
consents: {
  calls: true,
  phi: true,
  terms: true,
  consented_at: new Date().toISOString(),
}
```

---

## 7. Summary of consent-flow gaps requiring remediation

| # | Gap | Priority |
|---|---|---|
| 1 | Terms of Service and Privacy Policy do not exist; links point to `#` | P0 |
| 2 | Consents are bundled into a single checkbox | P0 |
| 3 | Call recording not explicitly disclosed | P0 |
| 4 | AI status not proactively disclosed at call open | P1 |
| 5 | No consent flow for care recipients (parents, children) | P1 |
| 6 | No explicit AI-processing / subprocessor disclosure | P1 |
| 7 | No per-consent withdrawal mechanism | P2 |
| 8 | Authorization form may not meet HIPAA §164.508 spec (if CE/BA) | P0 |
| 9 | Consent record does not capture IP / user-agent | P2 |
