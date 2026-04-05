# OpenAI BAA Request — Draft

## Email To: baa@openai.com

**Subject:** BAA Request — Quarterback Health (Healthcare Scheduling Platform)

---

Dear OpenAI BAA Team,

We are requesting a Business Associate Agreement (BAA) for our use of the OpenAI API in our healthcare coordination platform.

**Company Information:**
- Company Name: [COMPANY LEGAL NAME]
- Website: https://getquarterback.com
- Contact: [YOUR NAME], [TITLE]
- Email: [YOUR EMAIL]
- OpenAI Organization ID: [Find at https://platform.openai.com/settings/organization/general]

**Product Description:**
Quarterback Health is a healthcare management platform that helps patients stay on top of their medical care. We discover healthcare providers from financial transactions, track visit history, and coordinate appointment scheduling on behalf of patients using AI voice calls and intelligent insights.

**How We Use the OpenAI API:**

1. **Transaction Classification** (current use, no PHI)
   - Endpoint: Chat Completions API (gpt-4o-mini)
   - Purpose: Classify bank transaction merchant names as healthcare vs non-healthcare
   - Data sent: Merchant names, transaction amounts, Plaid category labels
   - No patient identifiers are included in these requests
   - PHI risk: None — this is financial data only

2. **Call Outcome Classification** (current use, potential PHI)
   - Endpoint: Chat Completions API (gpt-4o-mini)
   - Purpose: Classify the outcome of AI voice calls to doctor's offices (booked, failed, needs retry)
   - Data sent: Call transcripts which may contain patient names, provider names, appointment times
   - PHI risk: Moderate — transcripts may contain identifiable health information

3. **Patient-Facing AI Assistant** (planned use, requires BAA)
   - Endpoint: Chat Completions API (gpt-4o or gpt-4o-mini)
   - Purpose: Conversational assistant ("Kate") that answers patient questions about their healthcare status, upcoming appointments, and overdue care
   - Data sent: Provider names, visit dates, appointment status, booking history — associated with an authenticated user
   - PHI risk: High — this is identifiable health information

**Technical Controls We Will Implement:**
- Zero data retention: We will configure all API requests with zero-retention settings per OpenAI's HIPAA-eligible configuration
- No training: We confirm that our data should NOT be used for model training
- Encryption: All API calls use HTTPS/TLS encryption in transit
- Access controls: PHI-containing API calls are only made from authenticated, server-side routes — never from client browsers
- Audit logging: All API calls that process PHI are logged with timestamps and request IDs
- Minimum necessary: We only send the minimum data required for each request — no bulk data exports

**Data Flow:**
- Patient data is stored in our Supabase (PostgreSQL) database
- Server-side API routes (Next.js on Vercel) make calls to OpenAI
- No PHI is sent from client-side code
- OpenAI responses are used to generate insights displayed to the authenticated patient only

**Compliance Posture:**
- We are building our platform with HIPAA compliance as a design requirement
- We are implementing administrative, physical, and technical safeguards
- This BAA request is part of our broader compliance program
- We are prepared to sign OpenAI's standard BAA terms

**Requested API Services Under BAA:**
- Chat Completions API (gpt-4o-mini, gpt-4o)
- With zero data retention enabled

We are happy to provide any additional information needed for the evaluation. Please let us know the next steps.

Thank you,
[YOUR NAME]
[TITLE]
[COMPANY LEGAL NAME]
[YOUR EMAIL]
[YOUR PHONE]

---

## After Sending

**What to expect:**
1. OpenAI typically responds within 1-2 business days
2. They may ask follow-up questions about your data flows
3. Once approved, they'll send the BAA for signature
4. After signing, you need to configure zero-retention on your API usage

**Technical changes needed after BAA is signed:**
1. Enable zero-retention in OpenAI API settings (Organization Settings → Data Controls)
2. Or pass `store: false` on each API request
3. Update our code to include zero-retention headers on PHI-containing requests

**Azure Alternative:**
If OpenAI's process is slow, Azure OpenAI Service includes a BAA automatically through Microsoft's standard Data Protection Addendum. Same models (GPT-4o, GPT-4o-mini), just a different API endpoint. Code change is minimal — swap the OpenAI client initialization to point to Azure.
