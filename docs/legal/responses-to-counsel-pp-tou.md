# Quarterback Health — Responses to Counsel Comments

**Documents reviewed:**
- Quarterback AI, LLC — Privacy Policy (5-6-24)
- Quarterback AI, LLC — Terms of Use (5-6-26)

**Reference email for all placeholders:** `admin@getquarterback.com`

---

## Part 1 — Privacy Policy

### Comment 0 — General consumer-rights language for all users (not state-gated)

Agreed. We will apply access/delete/correct/portability rights to all users, not gate by state. Given the sensitivity of health data and our preference for a uniform UX, the consumer-facing posture is the prudent path.

### Comment 1 — Consumer Health Data Privacy Policy

Understood. We will wait for your draft and host it on a separate URL from the main Privacy Policy.

### Comment 2 — Table of Contents jump links

Will do. We will wire anchor links from each TOC entry to its corresponding section when we publish.

### Comment 3 — Personal Data table accuracy and Health Partners scope

The chart is accurate.

**On the "shared with Health Partners at your direction" question:** When a user authorizes Quarterback AI / Kate to engage a provider (book an appointment, request records, refill a prescription), we share the minimum data needed for that specific interaction. Typically:

- Patient name
- Date of birth
- Phone number
- Insurance carrier
- Reason for the visit at the level of generality the user gives us

Kate also speaks the contents of the call itself with the office on the user's behalf. We do not share weight, lifestyle data, lab values, or free-text health notes with providers unless the user has explicitly directed us to do so.

**On ADA accessibility:** We will use proper `<th scope="col">` markup when we render the data table on the site so assistive technologies can announce it correctly.

### Comment 4 — Third-party authentication

Yes — we support Google OAuth via Supabase for sign-in. The chart already covers this under "Credentialing Data."

### Comments 5 and 6 — "Please review and confirm"

Both confirmed.

### Comment 7 — Adtech and pixels

No retargeting or advertising pixels currently. We use:

- **Google Analytics 4** with `ads_storage` denied by default.
- Consent gated through **Cookiebot**.

No Meta Pixel, LinkedIn Insight, or other ad-tech vendors. If that changes we will come back to update.

### Comment 8 — Third-party retargeting cookies

No retargeting cookies in use. **Please remove both the "Retargeting/Advertising Cookies" bullet from the Cookies list and the "Targeted Advertising" section entirely.** We do not sell or share data for cross-context behavioral advertising and do not want to imply we might.

### Comment 9 — Link to cookie management settings

We are already integrated with Cookiebot. The `[LINK]` placeholders can point to the Cookiebot consent-renew dialog (we will wire it on the site).

### Comment 10 — Retention examples

Please use these as the customized examples:

- **Account profile and credentials:** for the life of your account, then for up to 90 days after deletion.
- **Payment data:** through the end of the active subscription, then as required for tax and accounting purposes (currently 7 years).
- **Device/IP and security logs:** 90 days.
- **Health records you upload or authorize us to retrieve:** for the life of your account, deletable on request.
- **Call recordings and transcripts** (when you have enabled the Messages and Recording/Transcription Services): 2 years from the date of the call, deletable on request.

### Comment 11 — Hyperlink section references

Will do throughout when we publish.

### Placeholders to fill

- **Effective date:** will set on publish.
- **Terms of Use URL:** `https://www.getquarterback.com/terms`
- **Printable version URL:** `https://www.getquarterback.com/privacy/print` (we will build this).
- **Contact email** (all references): `admin@getquarterback.com`
- **Request form URL:** `https://www.getquarterback.com/privacy/request` (we will build this).
- **Website** (final contact block): `https://www.getquarterback.com`

---

## Part 2 — Terms of Use

### Comment 0 — Deployment guidance (affirmative acceptance, record keeping, update notifications)

Noted. Where we are today:

- Our onboarding flow already requires an affirmative checkbox stating *"I agree to the Terms and Privacy Policy, and authorize Quarterback Health to call offices and use my info to coordinate my care"* before account creation completes.
- The Terms and Privacy Policy will be linked in the footer on every page of the site.
- On material Terms updates we will follow your suggested protocol: email notice in advance, force log-out, and require re-acceptance with a bullet summary of changes above the consent button.
- We are working on the record-keeping side — we will persist the timestamp, method (web vs. mobile), and the document version each user accepted. We will have this in place before broader launch.

### Comment 1 — Section jump links

Will do when we render the Terms on the site, same as for the Privacy Policy.

### Comment 3 — Health Care Provider interactions

**Keep this section.** Quarterback Health's core feature is facilitating user interactions with healthcare providers. Kate (our AI care coordinator) places phone calls to doctor offices on the user's behalf to schedule appointments, request records, and handle refills. Users also may upload records they obtained from their providers. The HIPAA Notice of Privacy Practices clarification is relevant and should remain.

### Comments 6 and 7 — Move paid-services details to a separate page

Agreed. We will create a **Paid Services page** at `https://www.getquarterback.com/pricing-terms` covering:

- Current plans and pricing (free tier with limited usage; paid tiers starting at $24/mo and $49/mo).
- How we notify users of fee changes (email plus in-app notice, at least 14 days before any increase).
- **Refund policy:** no refunds for partial billing periods. Cancellation takes effect at the end of the current billing cycle and stops auto-renewal. Refunds outside that window are at our discretion for billing errors only.
- For mobile app purchases through the Apple App Store or Google Play, refunds are handled by the respective store per its terms.

Please link to that URL from the Terms instead of describing fees inline.

### Comment 8 — Recurring billing and auto-renewal language

The standard language works. Confirming our compliance with the five mandated requirements:

1. **Clear renewal terms before signup:** the subscription page will state *"Renews monthly until you cancel"* with cancellation instructions visible.
2. **Affirmative consent before charging:** users must check an explicit acknowledgement box on the checkout page.
3. **Retainable form of subscription terms:** Stripe sends a confirmation email after every successful checkout with the plan name, price, billing cycle, and a link to manage the subscription. We will mirror that with an in-product receipt.
4. **Simple cancellation mechanism:** "Cancel subscription" button in Account Settings — one click, no friction.
5. **Advance notice for material changes:** email at least 14 days before any price increase or material change.

### Comment 9 — Referral structure

We do not have a referral program at launch, and do not plan to roll one out until at least Q3 once we have meaningful usage data. **Please remove the entire Referral Program section for now.** We will come back to add it when we are ready.

### Yellow-highlighted placeholders to fill

- **Effective date:** will set on publish.
- **Support email:** `admin@getquarterback.com`
- **Privacy Policy link** (multiple references): `https://www.getquarterback.com/privacy`
- **Paid Services page link:** `https://www.getquarterback.com/pricing-terms`
- **Account Settings link** (multiple references): `https://www.getquarterback.com/account`
- **Referral page link:** remove with the section per Comment 9.

The mailing address line (20 Glory Road, Weston, CT 06883) is already correct.
