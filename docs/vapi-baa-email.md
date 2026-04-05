# Email to VAPI — BAA and HIPAA Compliance

To: support@vapi.ai
Subject: BAA Request + HIPAA Compliance Questions — Quarterback Health

---

Hi VAPI team,

We're building a healthcare scheduling platform (Quarterback Health — getquarterback.com) that uses VAPI to make outbound calls to doctor's offices to book appointments on behalf of patients.

We're working through HIPAA compliance for our platform and have a few questions:

1. Business Associate Agreement (BAA)
Do you offer a BAA for HIPAA-covered use cases? Our calls involve patient names, provider names, dates of birth, insurance information, and appointment details — all of which qualify as Protected Health Information (PHI).

If you do offer a BAA, could you send us the process to get one in place?

2. Data Handling
- Are call recordings and transcripts stored? If so, where and for how long?
- Can we configure zero-retention or automatic deletion of call data?
- Is data encrypted at rest and in transit?
- Are call recordings/transcripts accessible to VAPI employees?

3. Infrastructure
- Do you use Twilio for phone infrastructure? If so, is your Twilio account covered under a BAA with them?
- Where are calls processed and stored geographically?
- Do you have SOC 2 or other security certifications?

4. PHI in Variable Values
We pass patient information (name, DOB, insurance) through `assistantOverrides.variableValues` in the API call. How is this data handled on your end? Is it logged, stored, or used for any purpose beyond the call?

5. Transcripts and Webhooks
Our webhook receives call transcripts at the end of each call. Are these transcripts also stored on VAPI's servers? Can we ensure they're deleted after delivery?

6. Alternative Configuration
If a standard BAA isn't available yet, is there a HIPAA-eligible configuration we can use (similar to OpenAI's zero-retention API option)?

We're actively signing BAAs with our other vendors (OpenAI, etc.) and want to make sure our entire stack is covered. Happy to jump on a call to discuss if that's easier.

Thank you,
[YOUR NAME]
[TITLE]
Quarterback Health
[YOUR EMAIL]
