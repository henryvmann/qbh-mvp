# Compliance Change Record — GA4 / Cookiebot Reconfiguration

| Field | Value |
|---|---|
| **Change ID** | QBH-COMP-2026-04-22-001 |
| **Date** | 2026-04-22 |
| **Change type** | Privacy / data-processing configuration |
| **Performed by** | Henry (henry@getquarterback.com) |
| **Approved by** | Henry (founder) |
| **Classification** | Preventive; no user-facing service impact |
| **Urgency** | P0 — required for Gunderson Dettmer privacy policy questionnaire Q17 to be answerable as "No" |
| **Downtime** | None |
| **Rollback plan** | Each toggled setting can be reverted individually via Google Analytics admin and Cookiebot admin |

---

## 1. Summary

Reconfigured Google Analytics 4 (property `G-T473FYH28S`) and Cookiebot consent management platform to operate strictly as service-provider tooling. The reconfiguration removes all Google "own-use" data flows, disables cross-context behavioral advertising features, shortens data retention to the minimum, and installs Google Consent Mode v2 Advanced so that consent state is signaled to Google and non-consenting users generate modeled (not personal) analytics.

After this change, Quarterback Health can truthfully represent that it does **not** sell or share personal data to third parties for monetary or non-monetary consideration under the expanded definitions in California CCPA/CPRA, Colorado Privacy Act, Connecticut CTDPA, Texas TDPSA, Virginia CDPA, and peer state privacy laws.

---

## 2. Context / business justification

Quarterback Health is preparing to submit a privacy-policy questionnaire to outside counsel (Gunderson Dettmer Stough Villeneuve Franklin & Hachigian, LLP) ahead of first engagement.

Question 17 of the questionnaire asks whether Quarterback Health sells personal data. The expanded definition in the questionnaire covers "disclosure of personal data to third parties through the use of online tracking technologies... in exchange for monetary or other valuable consideration, including ... analytics; or free or discounted services."

As configured at the start of 2026-04-22, Google Analytics 4 on `quarterback-health.com` was using default data-sharing settings that allowed Google to use event data for its own purposes. Under the expanded definition, this arguably qualified as a "sale" and would have required Quarterback Health to add "Do Not Sell or Share" links, opt-out mechanisms, and additional privacy-policy disclosures, as well as trigger the Texas TDPSA prior-consent requirement for sensitive personal data.

Reconfiguring GA4 to a service-provider-only posture removes this exposure.

---

## 3. Inventory of changes

### 3.1 Google Analytics 4 — Account-level data sharing

**Location**: GA4 Admin → Account → Account details → Data Sharing Settings

| Setting | Before | After |
|---|---|---|
| Google products & services | Unchecked | Unchecked (unchanged) |
| Modeling contributions & business insights | Checked | Unchecked |
| Technical support | Checked | Unchecked |
| Recommendations for your business | Checked | Unchecked |

### 3.2 Google Analytics 4 — Data Processing Amendment (DPA)

**Location**: GA4 Admin → Account → Account details → Data Processing Terms

| Item | State |
|---|---|
| DPA accepted | Yes — April 2, 2026 (prior to tonight's work) |
| DPA contact details | On file via GA4 admin |

Effect: Google contractually acts as a data processor / service provider for Quarterback Health's GA4 data.

### 3.3 Google Analytics 4 — Property data collection

**Location**: GA4 Admin → Property → Data collection and modification → Data collection

| Setting | Before | After |
|---|---|---|
| Google Signals data collection | Disabled (already off) | Disabled (unchanged) |
| User-provided data collection (beta) | Disabled (already off) | Disabled (unchanged) |
| Granular location and device data collection | Enabled (all regions) | Disabled |
| Advanced settings to allow for ads personalization | Allowed in 307 of 307 regions | Disabled in all 307 regions |

### 3.4 Google Analytics 4 — Data retention

**Location**: GA4 Admin → Property → Data collection and modification → Data retention

| Setting | Before | After |
|---|---|---|
| User data retention | 14 months (default) | 2 months |
| Event data retention | 14 months (default) | 2 months |
| Reset user data on new activity | On | On (unchanged) |

### 3.5 Application code — Google Consent Mode v2 Advanced

**Location**: `src/app/layout.js`

Added inline Google Consent Mode v2 defaults script with `strategy="beforeInteractive"` to ensure it loads before the GA4 gtag.js script. The default consent state is "denied" for every category except `security_storage`, with `wait_for_update: 500` ms to allow Cookiebot to update the consent state after user interaction.

Concrete change summary:
- Added `<Script id="gcm-defaults" strategy="beforeInteractive">` block before the existing GA4 script tags
- Block sets default consent to denied for: `ad_personalization`, `ad_storage`, `ad_user_data`, `analytics_storage`, `functionality_storage`, `personalization_storage`
- Block sets `security_storage: granted` (required for session-auth cookies to function)
- Block sets `ads_data_redaction: true` and `url_passthrough: false`

### 3.6 Cookiebot consent management platform

**Location**: admin.cookiebot.com → QBH domain group

Cookiebot had been deployed earlier in the same session (see prior compliance record for Cookiebot initial deployment once filed).

Verification performed during tonight's session:
- Google Consent Mode integration: enabled in Cookiebot configuration
- GPC (Global Privacy Control) signal honoring: to confirm during Part 8 follow-up (flagged as open)
- Analytics category cookies: GA4 cookies (`_ga`, `_ga_*`, `_gid`) correctly categorized under Statistics
- Necessary category cookies: Supabase auth cookies (`sb-*`) and Cookiebot's own `CookieConsent` cookie correctly categorized
- No cookies detected in Marketing / Advertising category (expected, since no ad pixels are installed)

---

## 4. Verification results

### 4.1 Network-level verification (incognito browser, DevTools Network panel, filter = `collect`)

| Test | Expected | Result |
|---|---|---|
| Load site in fresh incognito, before banner interaction | Zero GA4 `collect` requests | Pass |
| Click "Decline" on Cookiebot banner, refresh | Zero GA4 `collect` requests | Pass |
| Click "Accept" on Cookiebot banner, refresh | GA4 `collect` requests fire | Pass |

### 4.2 GA4 admin state verification

All settings confirmed in the reconfigured state by visual inspection of the GA4 admin on 2026-04-22.

---

## 5. Residual open items

| # | Item | Owner | Target |
|---|---|---|---|
| 1 | Run Part 8 Cookiebot dashboard verification (six checks: Consent Mode v2 Advanced mode, GPC honoring, scan currency, regional behavior, consent logging, privacy policy URL in banner) | Henry | Within 48 hours of this record |
| 2 | Verify Cookiebot banner "Privacy Policy" link points to a placeholder page rather than `#` | Henry | Before launch |
| 3 | Re-run Network verification after Google Consent Mode v2 Advanced deployment, confirm modeled pings appear from declined users | Henry / engineering | Within 1 week |
| 4 | Preserve weekly consent log exports from Cookiebot for audit trail | Henry | Ongoing |

---

## 6. Regulatory impact

### 6.1 Privacy-law posture improved

This change moves Quarterback Health from an ambiguous "Yes, but not for money" posture on Q17 to a defensible "No" posture under the expanded definitions used in:

- California CCPA / CPRA
- Colorado Privacy Act (CPA)
- Connecticut Data Privacy Act (CTDPA)
- Texas Data Privacy and Security Act (TDPSA)
- Virginia Consumer Data Protection Act (CDPA)
- Utah Consumer Privacy Act (UCPA)
- Oregon Consumer Privacy Act (OCPA)
- Delaware Personal Data Privacy Act (DPDPA)
- Iowa, Montana, Nebraska, New Hampshire, New Jersey, Tennessee, Minnesota, Maryland, Indiana, Kentucky, Rhode Island consumer privacy statutes

### 6.2 Texas TDPSA sensitive-data consent

With Q17 answered as "No," the related Q18.1 Texas TDPSA prior-consent-for-sensitive-data-sale question no longer applies. Quarterback Health is not selling sensitive personal data to any third party under this configuration.

### 6.3 Washington MHMDA

The Washington My Health My Data Act imposes strict limits on the collection, sharing, and sale of consumer health data. This change reduces MHMDA exposure by ensuring no consumer health data flows to Google for Google's own purposes.

### 6.4 Items NOT addressed by this change

This change does not, by itself, resolve:

- Classification of Quarterback Health as Covered Entity, Business Associate, or Personal Health Records vendor under HIPAA — awaiting counsel determination
- Subprocessor BAAs with Supabase, OpenAI, VAPI, Vercel — separate workstream
- Consent-flow remediation (bundled checkbox, placeholder Terms/Privacy links, two-party call recording consent, AI disclosure) — separate workstream
- Publication of final Terms of Service and Privacy Policy — pending counsel

---

## 7. SOC 2 / audit reference

This record is maintained as change-management evidence for future SOC 2 Type I and Type II examinations.

### 7.1 Relevant Trust Services Criteria

- **CC6.1** (Logical access — restrict data flows to those necessary for business purpose)
- **CC6.7** (Transmission / disclosure of confidential data)
- **CC8.1** (Change management)
- **P1** (Privacy — notice and consent)
- **P4** (Privacy — use, retention, and disposal of personal information)

### 7.2 Evidence to retain

- Screenshots of GA4 admin "Data Sharing Settings" showing all four boxes unchecked
- Screenshot of GA4 admin "Data Processing Terms" showing "Accepted April 2, 2026"
- Screenshot of "Google signals data collection" showing disabled state
- Screenshot of "Granular location and device data collection" showing disabled toggle
- Screenshot of "Ads personalization" showing "0 of 307 regions"
- Screenshot of "Data retention" showing "2 months" for both user and event retention
- Git commit SHA of the `src/app/layout.js` change adding Google Consent Mode v2 defaults
- Browser DevTools Network panel screenshots from each of the three Part 7 verification tests
- Cookiebot dashboard configuration screenshot (to be captured in Part 8)

**Action item**: collect and save the above into a dated evidence folder under `docs/compliance/evidence/2026-04-22/`.

---

## 8. Related documents

- `docs/legal/data-flow-diagram.md`
- `docs/legal/vendor-inventory.md`
- `docs/legal/security-measures.md`
- `docs/legal/consent-flow.md`
- `docs/legal/marketing-copy-audit.md`
- `docs/legal/summary-for-counsel.md`
- Gunderson Dettmer privacy policy questionnaire (provided 2026-04-22; response in progress)

---

## 9. Change-record sign-off

| Role | Name | Date | Signature / confirmation |
|---|---|---|---|
| Performer | Henry | 2026-04-22 | Self-confirmed via session transcript |
| Approver | Henry (founder) | 2026-04-22 | Self-approved as sole decision-maker |
| Technical reviewer | TBD | — | Pending second set of eyes on GA4 admin state |
| Counsel review | TBD — Gunderson Dettmer | — | To be reviewed in first engagement meeting |

---

## 10. Post-meeting follow-up

After the Gunderson Dettmer engagement meeting, revisit this record to:

- Incorporate counsel's classification determination (CE / BA / PHR)
- Confirm the "service provider" characterization of Google is consistent with counsel's interpretation of applicable state laws
- Attach any counsel-recommended additional controls (e.g., further GA4 restrictions, alternative analytics platform, elimination of GA4 entirely)

---

*End of record.*
