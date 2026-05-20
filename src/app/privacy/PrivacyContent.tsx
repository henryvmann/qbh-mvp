/**
 * Privacy Policy body extracted to a shared component so the public
 * /privacy page and the /privacy/print printable view stay in sync.
 *
 * When counsel's revised text lands, edit this file only.
 */

export default function PrivacyContent({ lastUpdated }: { lastUpdated: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-[#071832] mb-2 print:text-2xl">Privacy Policy</h1>
      <p className="text-sm text-[#4F5F73] mb-10 print:mb-6">Last updated: {lastUpdated}</p>

      <div className="space-y-8 text-[#3A3F4B] text-sm leading-relaxed print:space-y-4">
        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">1. Who We Are</h2>
          <p>
            Quarterback Health (&quot;QBH,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Quarterback Health
            platform at getquarterback.com and associated mobile applications. We provide a healthcare
            coordination service that helps you manage your providers, appointments, and health
            administration.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">2. Information We Collect</h2>
          <p className="mb-3">We collect information you provide directly, including:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Account information:</strong> name, email address, password, date of birth, phone number</li>
            <li><strong>Health administration data:</strong> insurance provider and member ID, provider names and contact information, appointment dates and notes</li>
            <li><strong>Care recipient information:</strong> names and relationships of people you manage care for</li>
            <li><strong>Health documents:</strong> documents you upload for summarization (lab results, visit summaries, etc.)</li>
            <li><strong>Survey responses:</strong> your answers during onboarding about health priorities</li>
          </ul>

          <p className="mt-4 mb-3">We also collect information from connected services you authorize:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Bank transactions (via Plaid):</strong> healthcare-related transaction descriptions and dates to identify your providers. We do not access account balances, non-healthcare transactions, or financial account numbers.</li>
            <li><strong>Calendar events (via Google/Outlook):</strong> appointment titles, dates, and times to match with your providers. We only read healthcare-related events.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">3. Google Workspace API Limited Use</h2>
          <p>
            Quarterback Health&rsquo;s use and transfer to any other app of information received from
            Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p className="mt-3">
            The use of raw or derived user data received from Workspace APIs will adhere to the
            Google User Data Policy, including the Limited Use requirements.
          </p>
          <p className="mt-3">
            Specifically, calendar data we read from Google is used solely to identify and display
            your healthcare appointments inside Quarterback Health. We do not transfer this data
            to others, do not use it for advertising, do not allow humans to read it (except as
            required for security, abuse investigation, with your explicit consent, or where
            required by law), and do not use it to train generalized AI models.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">4. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Organize and display your healthcare providers, appointments, and care team</li>
            <li>Make AI-assisted phone calls to provider offices on your behalf to schedule appointments</li>
            <li>Provide personalized suggestions through Kate, our AI care coordinator</li>
            <li>Summarize health documents you upload</li>
            <li>Identify care gaps and recommend preventive care based on your age and health profile</li>
            <li>Send you notifications about upcoming appointments or action items</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">5. AI and Automated Processing</h2>
          <p>
            We use artificial intelligence services (including OpenAI) to power Kate&apos;s chat responses,
            summarize health documents, classify transactions, and generate care suggestions. When we
            send your information to AI providers, we use their API services with data protection
            agreements in place. Your data is not used to train AI models. We use AI for care
            coordination assistance only. Kate does not provide medical advice, diagnoses, or
            treatment recommendations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">6. AI Phone Calls</h2>
          <p>
            When you authorize it, our AI assistant Kate will call healthcare provider offices on your
            behalf to schedule, reschedule, or inquire about appointments. These calls are made using
            voice AI technology (via VAPI). Call transcripts and summaries are stored in your account.
            We only place calls during business hours (9 AM to 6 PM ET, Monday through Friday) and
            only to provider offices you have designated.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">7. Data Storage and Security</h2>
          <p>
            Your account and provider data is stored in Supabase (cloud database) with encryption at
            rest. Health documents you upload are stored in AWS S3 with KMS encryption under
            pseudonymized identifiers. Your real identity is not linked to stored files.
            All data transmission uses TLS encryption. We implement access controls, audit logging,
            and follow industry-standard security practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">8. Data Sharing</h2>
          <p className="mb-3">We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Service providers:</strong> Supabase (database), OpenAI (AI processing), VAPI/Twilio (voice calls), Plaid (bank connections), Google (calendar), AWS (file storage). Each is under a data protection agreement.</li>
            <li><strong>Healthcare provider offices:</strong> your name, date of birth, insurance, and appointment preferences when Kate calls on your behalf</li>
            <li><strong>Legal requirements:</strong> if required by law, court order, or governmental authority</li>
          </ul>
          <p className="mt-3">We do not share your information with advertisers, data brokers, or any third parties for marketing purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">9. Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Access</strong> your personal information through your account settings</li>
            <li><strong>Correct</strong> inaccurate information in your profile</li>
            <li><strong>Delete</strong> your account and all associated data (Account page &rarr; &quot;Delete my account&quot;)</li>
            <li><strong>Disconnect</strong> linked services (bank, calendar) at any time</li>
            <li><strong>Opt out</strong> of AI phone calls or specific features</li>
          </ul>
          <p className="mt-3">
            To submit a formal privacy-rights request (access, delete, correct, portability, appeal),
            use our request form at{" "}
            <a href="/privacy/request" className="text-[#1677FF] underline">
              getquarterback.com/privacy/request
            </a>{" "}
            or email{" "}
            <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">
              admin@getquarterback.com
            </a>
            .
          </p>
          <p className="mt-3">
            California residents: Under the CCPA, you have additional rights including the right to
            know what personal information we collect, the right to request deletion, and the right
            to non-discrimination for exercising your rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">10. Cookies and Analytics</h2>
          <p>
            We use Cookiebot for cookie consent management and Google Analytics for understanding how
            our service is used. Analytics data is only collected with your consent. We use Google
            Consent Mode v2, which means no tracking occurs until you grant permission. You can manage
            your cookie preferences at any time via the cookie banner.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">11. Children&apos;s Privacy</h2>
          <p>
            Quarterback Health is not intended for individuals under 18 years of age. We do not
            knowingly collect information from children. If you believe a minor has provided us with
            personal information, please contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by email or through the application. Your continued use of the service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mb-3">13. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, contact us at:<br />
            <strong>Email:</strong>{" "}
            <a href="mailto:admin@getquarterback.com" className="underline">
              admin@getquarterback.com
            </a>
            <br />
            <strong>Website:</strong> getquarterback.com
          </p>
        </section>
      </div>
    </>
  );
}
