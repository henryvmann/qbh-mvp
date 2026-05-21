/**
 * Terms of Use body from counsel (effective 5/20/26). Extracted to a
 * shared component so /terms and /terms/print stay in sync — edit
 * here, both routes update.
 *
 * When counsel turns a new version, replace the body, bump
 * LEGAL_DOC_VERSIONS.terms in src/lib/legal-doc-versions.ts, and
 * (once re-acceptance UI exists) trigger force log-out + re-consent.
 */

import Link from "next/link";

const PrivacyLink = ({ children = "Privacy Policy" }: { children?: React.ReactNode }) => (
  <Link href="/privacy" className="text-[#1677FF] underline">{children}</Link>
);
const PaidServicesLink = ({ children = "Paid Services page" }: { children?: React.ReactNode }) => (
  <Link href="/pricing-terms" className="text-[#1677FF] underline">{children}</Link>
);
const AccountSettingsLink = ({ children = "account settings" }: { children?: React.ReactNode }) => (
  <Link href="/billing" className="text-[#1677FF] underline">{children}</Link>
);
const AdminEmail = () => (
  <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a>
);

export default function TermsContent({ effectiveDate }: { effectiveDate: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-[#071832] mb-2 print:text-2xl">Terms of Use</h1>
      <p className="text-sm text-[#4F5F73] mb-10 print:mb-6">Effective date: {effectiveDate}</p>

      <div className="space-y-6 text-[#3A3F4B] text-sm leading-relaxed print:space-y-3">
        <p>
          Welcome to Quarterback Health. Please read on to learn the rules and restrictions
          that govern your use of our website(s), products, services and applications (the
          &ldquo;Services&rdquo;). If you have any questions, comments, or concerns regarding
          these terms or the Services, please contact us at:
        </p>
        <p>
          <strong>Email:</strong> <AdminEmail /><br />
          <strong>Address:</strong> 20 Glory Road, Weston, Connecticut 06883
        </p>
        <p>
          These Terms of Use (the &ldquo;Terms&rdquo;) are a binding contract between you and
          QUARTERBACK AI, LLC (&ldquo;Quarterback Health,&rdquo; &ldquo;we&rdquo; and
          &ldquo;us&rdquo;). Your use of the Services in any way means that you agree to all
          of these Terms, and these Terms will remain in effect while you use the Services.
          These Terms include the provisions in this document as well as those in the{" "}
          <PrivacyLink />. Your use of or participation in certain Services may also be subject
          to additional policies, rules and/or conditions (&ldquo;Additional Terms&rdquo;),
          which are incorporated herein by reference, and you understand and agree that by
          using or participating in any such Services, you agree to also comply with these
          Additional Terms.
        </p>
        <p>
          Please read these Terms carefully. They cover important information about Services
          provided to you and any charges, taxes, and fees we bill you. These Terms include
          information about future changes to these Terms, automatic renewals, limitations of
          liability, a class action waiver and resolution of disputes by arbitration instead
          of in court.{" "}
          <strong>
            PLEASE NOTE THAT YOUR USE OF AND ACCESS TO OUR SERVICES ARE SUBJECT TO THE
            FOLLOWING TERMS; IF YOU DO NOT AGREE TO ALL OF THE FOLLOWING, YOU MAY NOT USE OR
            ACCESS THE SERVICES IN ANY MANNER.
          </strong>
        </p>
        <p>
          <strong>
            ARBITRATION NOTICE AND CLASS ACTION WAIVER: EXCEPT FOR CERTAIN TYPES OF DISPUTES
            DESCRIBED IN THE ARBITRATION AGREEMENT SECTION BELOW, YOU AGREE THAT DISPUTES
            BETWEEN YOU AND US WILL BE RESOLVED BY BINDING, INDIVIDUAL ARBITRATION AND YOU
            WAIVE YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE
            ARBITRATION.
          </strong>
        </p>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">Will these Terms ever change?</h2>
          <p>
            We are constantly trying to improve our Services, so these Terms may need to
            change along with our Services. We reserve the right to change the Terms at any
            time, but if we do, we will place a notice on our site located at
            www.getquarterback.com, send you an email, and/or notify you by some other means.
          </p>
          <p className="mt-3">
            If you don&rsquo;t agree with the new Terms, you are free to reject them;
            unfortunately, that means you will no longer be able to use the Services. If you
            use the Services in any way after a change to the Terms is effective, that means
            you agree to all of the changes.
          </p>
          <p className="mt-3">
            Except for changes by us as described here, no other amendment or modification of
            these Terms will be effective unless in writing and signed by both you and us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What about my privacy?</h2>
          <p>
            Quarterback Health takes the privacy of its users very seriously. For the current
            Quarterback Health Privacy Policy, please <PrivacyLink>click here</PrivacyLink>.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">Children&rsquo;s Online Privacy Protection Act</h3>
          <p>
            The Children&rsquo;s Online Privacy Protection Act (&ldquo;COPPA&rdquo;) requires
            that online service providers obtain parental consent before they knowingly
            collect personally identifiable information online from children who are under 13
            years of age. We do not knowingly collect or solicit personally identifiable
            information from children under 13 years of age; if you are a child under 13 years
            of age, please do not attempt to register for or otherwise use the Services or
            send us any personal information. If we learn we have collected personal
            information from a child under 13 years of age, we will delete that information as
            quickly as possible. If you believe that a child under 13 years of age may have
            provided us personal information, please contact us at <AdminEmail />.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">Health Insurance Portability &amp; Accountability Act</h3>
          <p>
            Some professionals you may interact with in connection with our Services qualify
            as &ldquo;health care providers&rdquo; under the Health Insurance Portability
            &amp; Accountability Act (&ldquo;Health Care Providers&rdquo; and
            &ldquo;HIPAA&rdquo;, respectively). Such Health Care Providers may require you to
            review and acknowledge their specific HIPAA Notice of Privacy Practices; any such
            terms are between you and such Health Care Provider. We encourage you to review
            our <PrivacyLink />, which provides additional information on how Quarterback
            Health may use your Personal Data (as defined in the Privacy Policy) and any
            communications between you and such Health Care Provider.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What are the basics of using Quarterback Health?</h2>
          <p>
            You may be required to sign up for an account, select a password and user name
            (&ldquo;Quarterback Health User ID&rdquo;), and provide us with certain
            information or data, such as your contact information. You promise to provide us
            with accurate, complete, and updated registration information about yourself. You
            may not select as your Quarterback Health User ID a name that you do not have the
            right to use, or another person&rsquo;s name with the intent to impersonate that
            person. You may not transfer your account to anyone else without our prior written
            permission.
          </p>
          <p className="mt-3">
            You represent and warrant that you are an individual of legal age to form a
            binding contract (or if not, you&rsquo;ve received your parent&rsquo;s or
            guardian&rsquo;s permission to use the Services and have gotten your parent or
            guardian to agree to these Terms on your behalf).
          </p>
          <p className="mt-3">
            You will only use the Services for your own internal, personal, non-commercial
            use, and not on behalf of or for the benefit of any third party, and only in a
            manner that complies with all laws that apply to you. If your use of the Services
            is prohibited by applicable laws, then you aren&rsquo;t authorized to use the
            Services. We can&rsquo;t and won&rsquo;t be responsible for your using the
            Services in a way that breaks the law.
          </p>
          <p className="mt-3">
            You will not share your Quarterback Health User ID, account or password with
            anyone, and you must protect the security of your Quarterback Health User ID,
            account, password and any other access tools or credentials. You&rsquo;re
            responsible for any activity associated with your Quarterback Health User ID and
            account.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">AI Features</h3>
          <p>
            We may, as part of the Services, offer features that incorporate or are powered by
            artificial intelligence technologies. These Services are referred to as &ldquo;AI
            Features&rdquo;. As part of the Services, you may provide User Submissions
            (defined below) to be processed by the Services and receive outputs generated and
            returned by the Services based on the inputs (&ldquo;Outputs&rdquo;). You
            acknowledge and agree that (i) artificial intelligence and machine learning are
            rapidly evolving fields of study, and given the probabilistic nature of machine
            learning, use of the Services may in some situations result in incorrect or
            inaccurate Outputs, and (ii) you must verify the accuracy and appropriateness of
            any Outputs that are provided by the Services before relying on any such Outputs.
            For example, &ldquo;Kate&rdquo; is an AI Feature on the Services that permits you
            to chat with an automated personal artificial intelligence chatbot. Any Output,
            advice or information you receive from Kate is generated using artificial
            intelligence and is not generated by a human; you acknowledge and agree that Kate
            is experimental, and we cannot ensure such advice or information is accurate or
            appropriate for your condition or use case. You agree that you use the Output from
            Kate at your own discretion. Kate is not a substitute for professional medical
            advice, diagnosis, or treatment.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">No Medical Advice; Not for Emergencies</h3>
          <p>
            Quarterback Health does not offer medical advice or diagnoses, or engage in the
            practice of medicine. Our Services are not intended to be a substitute for
            professional medical advice, diagnosis, or treatment and are offered for
            informational and communicative purposes only. The Services are not intended to
            be, and must not be taken to be, the practice of medicine, nursing, pharmacy or
            other healthcare advice by Quarterback Health.
          </p>
          <p className="mt-3">
            The Services are not meant to diagnose or treat any conditions. Only your medical
            professional can determine the right course of treatment for you and determine
            what is safe, appropriate and effective based on your needs. Reliance on any
            information provided by Quarterback Health or in connection with the Services is
            solely at your own risk. You are solely responsible for any decisions or actions
            you take based on the information and materials available through the Services.
          </p>
          <p className="mt-3">
            You acknowledge that although some Content (defined below) may be provided by
            individuals in the medical profession, the provision of such Content does not
            create a medical professional/patient relationship between you and Quarterback
            Health or between you and any other individual or entity, and does not constitute
            an opinion, medical advice, or diagnosis or treatment. Healthcare providers and
            patients should always obtain applicable diagnostic information from appropriate
            trusted sources. Healthcare providers should never withhold professional medical
            advice or delay in providing it because of something they have read in connection
            with our Services.
          </p>
          <p className="mt-3">
            <strong>
              THE SERVICES SHOULD NEVER BE USED AS A SUBSTITUTE FOR EMERGENCY CARE. IF YOU
              HAVE A MEDICAL OR MENTAL HEALTH EMERGENCY, ARE THINKING ABOUT SUICIDE OR TAKING
              ACTIONS THAT MAY CAUSE HARM TO YOU OR TO OTHERS, YOU SHOULD SEEK EMERGENCY
              TREATMENT AT THE NEAREST EMERGENCY ROOM OR DIAL 911.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What about messaging?</h2>
          <p>
            As part of the Services, you may receive communications through the Services,
            including messages that Quarterback Health sends you (for example, via email or
            SMS). When signing up for the Services, you will receive a welcome message and
            instructions on how to stop receiving messages. By signing up for the Services and
            providing us with your wireless number, you confirm that you want Quarterback
            Health to send you information regarding your account or transactions with us,
            which may include Quarterback Health using automated dialing technology to text
            you at the wireless number you provided, and you agree to receive communications
            from Quarterback Health, and you represent and warrant that each person you
            register for the Services or for whom you provide a wireless phone number has
            consented to receive communications from Quarterback Health. You agree to
            indemnify and hold Quarterback Health harmless from and against any and all
            claims, liabilities, damages (actual and consequential), losses and expenses
            (including attorneys&rsquo; fees) arising from or in any way related to your
            breach of the foregoing.
          </p>
          <p className="mt-3">
            You may have the option to enable Quarterback Health to send messages, place
            calls, and initiate communications through the Services on your behalf
            (&ldquo;Messages&rdquo;). In addition, our Services may include features that
            enable Quarterback Health to record or transcribe communications
            (&ldquo;Recording and Transcription Services&rdquo;). If available, you may choose
            to use the Messages feature and the Recording and Transcription Services in your
            sole discretion. You acknowledge and agree that you shall be solely responsible
            for the content, timing, frequency, and recipients of the Messages, and that you
            will not use the Messages feature to send harassing, inappropriate, unlawful, or
            overly-frequent Messages to the intended recipient. You further acknowledge and
            agree that you are solely responsible for, and shall comply with, all federal,
            state, local, and foreign laws, rules, and regulations applicable to your use of
            the Messages, the Recording and Transcription Services, and any related
            communications or processing of personal information, including, without
            limitation, the Telephone Consumer Protection Act (47 U.S.C. § 227) and its
            implementing regulations, the CAN-SPAM Act, the Telemarketing Sales Rule, all
            applicable state telemarketing, telephone solicitation, automatic dialing statutes
            and their analogs (including, without limitation, the Florida Telephone
            Solicitation Act and similar state statutes), all applicable federal and state
            wiretapping, eavesdropping, call recording, and two-party consent statutes, and
            all applicable federal, state, and foreign privacy and data protection laws. You
            represent, warrant, and agree that (i) you will be solely responsible for
            providing any and all notices and obtaining any and all consents (including, where
            required, prior express written consent and all-party consent to recording) as may
            be required under applicable law prior to each use of the Messages or Recording
            and Transcription Services; (ii) you have not received, and will promptly honor,
            any revocation, opt-out, or do-not-contact request from any recipient; and (iii)
            your use of the Messages feature and the Recording and Transcription Services
            complies, and will comply, with applicable law. You further acknowledge that your
            failure to provide appropriate notices or obtain applicable consents may lead to
            both civil and criminal liability, and that Quarterback Health shall have no
            liability whatsoever for, and expressly disclaims any responsibility in connection
            with, your failure to comply with applicable laws or to provide any required
            notices or obtain any required consents. For the avoidance of doubt, such notice
            must disclose Quarterback Health as the provider of such Recording and
            Transcription Services. You agree to indemnify and hold Quarterback Health
            harmless from and against any and all claims, liabilities, damages (actual and
            consequential), losses and expenses (including attorneys&rsquo; fees) arising from
            or in any way related to (a) your breach of the foregoing representations,
            warranties, covenants, or obligations, (b) your use or misuse of the Messages
            feature or the Recording and Transcription Services, (c) any failure by you to
            provide required notices or obtain or maintain required consents, or (d) any
            actual or alleged violation by you of applicable laws.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">Are there restrictions in how I can use the Services?</h2>
          <p>
            You represent, warrant, and agree that you will not provide or contribute
            anything, including any Content or User Submission (as those terms are defined
            below), to the Services, or otherwise use or interact with the Services, in a
            manner that:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>infringes or violates the intellectual property rights or any other rights of anyone else (including Quarterback Health);</li>
            <li>violates any law or regulation, including, without limitation, any applicable export control laws, privacy laws or any other purpose not reasonably intended by Quarterback Health;</li>
            <li>is dangerous, harmful, fraudulent, deceptive, threatening, harassing, defamatory, obscene, or otherwise objectionable;</li>
            <li>jeopardizes the security of your Quarterback Health User ID, account or anyone else&rsquo;s (such as allowing someone else to log in to the Services as you);</li>
            <li>attempts, in any manner, to obtain the password, account, or other security information from any other user;</li>
            <li>violates the security of any computer network, or cracks any passwords or security encryption codes;</li>
            <li>runs Maillist, Listserv, any form of auto-responder or &ldquo;spam&rdquo; on the Services, or any processes that run or are activated while you are not logged into the Services, or that otherwise interfere with the proper working of the Services (including by placing an unreasonable load on the Services&rsquo; infrastructure);</li>
            <li>&ldquo;crawls,&rdquo; &ldquo;scrapes,&rdquo; or &ldquo;spiders&rdquo; any page, data, or portion of or relating to the Services or Content (through use of manual or automated means);</li>
            <li>copies or stores any significant portion of the Content; or</li>
            <li>decompiles, reverse engineers, or otherwise attempts to obtain the source code or underlying ideas or information of or relating to the Services.</li>
          </ul>
          <p className="mt-3">
            A violation of any of the foregoing is grounds for termination of your right to
            use or access the Services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What are my rights in the Services?</h2>
          <p>
            The materials displayed or performed or available on or through the Services,
            including, but not limited to, text, graphics, data, articles, photos, images,
            illustrations, Outputs, User Submissions (as defined below) and so forth (all of
            the foregoing, the &ldquo;Content&rdquo;) are protected by copyright and/or other
            intellectual property laws. You promise to abide by all copyright notices,
            trademark rules, information, and restrictions contained in any Content you access
            through the Services, and you won&rsquo;t use, copy, reproduce, modify, translate,
            publish, broadcast, transmit, distribute, perform, upload, display, license, sell,
            commercialize or otherwise exploit for any purpose any Content not owned by you,
            (i) without the prior consent of the owner of that Content or (ii) in a way that
            violates someone else&rsquo;s (including Quarterback Health&rsquo;s) rights.
            Subject to these Terms, we grant each user of the Services a worldwide,
            non-exclusive, non-sublicensable and non-transferable license to use (i.e., to
            download and display locally) Content solely for purposes of using the Services.
            Use, reproduction, modification, distribution or storage of any Content for any
            purpose other than using the Services is expressly prohibited without prior
            written permission from us. You understand that Quarterback Health owns the
            Services. You won&rsquo;t modify, publish, transmit, participate in the transfer
            or sale of, reproduce (except as expressly provided in this Section), create
            derivative works based on, or otherwise exploit any of the Services. The Services
            may allow you to copy or download certain Content, but please remember that even
            where these functionalities exist, all the restrictions in this section still
            apply.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">
            What about anything I contribute to the Services – do I have to grant any licenses
            to Quarterback Health or to other users?
          </h2>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">User Submissions</h3>
          <p>
            Anything you post, upload, share, store, or otherwise provide through the Services
            is your &ldquo;User Submission&rdquo;. You are solely responsible for all User
            Submissions you contribute to the Services. You represent that all User
            Submissions submitted by you are accurate, complete, up-to-date, and in compliance
            with all applicable laws, rules and regulations.
          </p>
          <p className="mt-3">
            You agree that you will not post, upload, share, store, or otherwise provide
            through the Services any User Submissions that: (i) infringe any third
            party&rsquo;s copyrights or other rights (e.g., trademark, privacy rights, etc.);
            (ii) contain sexually explicit content or pornography; (iii) contain hateful,
            defamatory, or discriminatory content or incite hatred against any individual or
            group; (iv) exploit minors; (v) depict unlawful acts or extreme violence; (vi)
            depict animal cruelty or extreme violence towards animals; (vii) promote
            fraudulent schemes, multi-level marketing (MLM) schemes, get rich quick schemes,
            online gaming and gambling, cash gifting, work from home businesses, or any other
            dubious money-making ventures; or (viii) that violate any law.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">Licenses</h3>
          <p>
            In order to display your User Submissions on the Services, you grant us certain
            rights in those User Submissions (see below for more information). Please note
            that all of the following licenses are subject to our <PrivacyLink /> to the
            extent they relate to User Submissions that are also your personally-identifiable
            information.
          </p>
          <p className="mt-3">
            For all User Submissions, you hereby grant Quarterback Health a license to
            translate, modify (for technical purposes, for example, making sure your content
            is viewable on a mobile device as well as a computer) and reproduce and otherwise
            act with respect to such User Submissions, in each case to enable us to operate
            the Services, as described in more detail below. This is a license only &mdash;
            your ownership in User Submissions is not affected.
          </p>
          <p className="mt-3">
            If you store a User Submission in your own personal Quarterback Health account, in
            a manner that is not viewable by any other user except you (a &ldquo;Personal User
            Submission&rdquo;), you grant Quarterback Health the license above, as well as a
            license to display, perform, and distribute your Personal User Submission for the
            sole purpose of making that Personal User Submission accessible to you and
            providing the Services necessary to do so.
          </p>
          <p className="mt-3">
            If you share a User Submission in a manner that only certain specified users can
            view (for example, a private message to one or more other users) (a
            &ldquo;Limited Audience User Submission&rdquo;), then you grant Quarterback Health
            the licenses above, as well as a license to display, perform, and distribute your
            Limited Audience User Submission for the sole purpose of making that Limited
            Audience User Submission accessible to such other specified users, and providing
            the Services necessary to do so. Also, you grant such other specified users a
            license to access that Limited Audience User Submission, and to use and exercise
            all rights in it, as permitted by the functionality of the Services.
          </p>
          <p className="mt-3">
            You agree that the licenses you grant are royalty-free, perpetual, sublicensable,
            irrevocable, and worldwide. In addition to the above, you agree that Quarterback
            Health may freely use, retain, and make available for Quarterback Health&rsquo;s
            business purposes data submitted to, collected by, or generated by Quarterback
            Health in connection with your use of the Services in aggregated or anonymized
            form which can in no way be linked specifically to you. Finally, you understand
            and agree that Quarterback Health, in performing the required technical steps to
            provide the Services to our users (including you), may need to make changes to
            your User Submissions to conform and adapt those User Submissions to the technical
            requirements of connection networks, devices, services, or media, and the
            foregoing licenses include the rights to do so.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">Who is responsible for what I see and do on the Services?</h2>
          <p>
            Any information or Content publicly posted or privately transmitted through the
            Services is the sole responsibility of the person from whom such Content
            originated, and you access all such information and Content at your own risk, and
            we aren&rsquo;t liable for any errors or omissions in that information or Content
            or for any damages or loss you might suffer in connection with it. We cannot
            control and have no duty to take any action regarding how you may interpret and
            use the Content or what actions you may take as a result of having been exposed to
            the Content, and you hereby release us from all liability for you having acquired
            or not acquired Content through the Services. We can&rsquo;t guarantee the
            identity of any users with whom you interact in using the Services and are not
            responsible for which users gain access to the Services.
          </p>
          <p className="mt-3">
            You are responsible for all Content you contribute, in any manner, to the
            Services, and you represent and warrant you have all rights necessary to do so,
            in the manner in which you contribute it.
          </p>
          <p className="mt-3">
            The Services may contain links or connections to third-party websites or services
            that are not owned or controlled by Quarterback Health. When you access
            third-party websites or use third-party services, you accept that there are risks
            in doing so, and that Quarterback Health is not responsible for such risks.
          </p>
          <p className="mt-3">
            Quarterback Health has no control over, and assumes no responsibility for, the
            content, accuracy, privacy policies, or practices of or opinions expressed in any
            third-party websites or by any third party that you interact with through the
            Services. In addition, Quarterback Health will not and cannot monitor, verify,
            censor or edit the content of any third-party site or service. We encourage you to
            be aware when you leave the Services and to read the terms and conditions and
            privacy policy of each third-party website or service that you visit or utilize.
            By using the Services, you release and hold us harmless from any and all liability
            arising from your use of any third-party website or service.
          </p>
          <p className="mt-3">
            Your interactions with organizations and/or individuals found on or through the
            Services, including payment and delivery of goods or services, and any other
            terms, conditions, warranties or representations associated with such dealings,
            are solely between you and such organizations and/or individuals. You should make
            whatever investigation you feel necessary or appropriate before proceeding with
            any online or offline transaction with any of these third parties. You agree that
            Quarterback Health shall not be responsible or liable for any loss or damage of
            any sort incurred as the result of any such dealings.
          </p>
          <p className="mt-3">
            If there is a dispute between participants on this site or Services, or between
            users and any third party, you agree that Quarterback Health is under no
            obligation to become involved. In the event that you have a dispute with one or
            more other users, you release Quarterback Health, its directors, officers,
            employees, agents, and successors from claims, demands, and damages of every kind
            or nature, known or unknown, suspected or unsuspected, disclosed or undisclosed,
            arising out of or in any way related to such disputes and/or our Services. You
            shall and hereby do waive California Civil Code Section 1542 or any similar law
            of any jurisdiction, which says in substance: &ldquo;A general release does not
            extend to claims that the creditor or releasing party does not know or suspect to
            exist in his or her favor at the time of executing the release and that, if known
            by him or her, would have materially affected his or her settlement with the
            debtor or released party.&rdquo;
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">Will Quarterback Health ever change the Services?</h2>
          <p>
            We&rsquo;re always trying to improve our Services, so they may change over time.
            We may suspend or discontinue any part of the Services, or we may introduce new
            features or impose limits on certain features or restrict access to parts or all
            of the Services. We&rsquo;ll try to give you notice when we make a material change
            to the Services that would adversely affect you, but this isn&rsquo;t always
            practical. We reserve the right to remove any Content from the Services at any
            time, for any reason (including, but not limited to, if someone alleges you
            contributed that Content in violation of these Terms), in our sole discretion,
            and without notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">Do the Services cost anything?</h2>
          <p>
            The Services may be free or we may charge a fee for using the Services. If you are
            using a free version of the Services, we will notify you before any Services you
            are then using begin carrying a fee, and if you wish to continue using such
            Services, you must pay all applicable fees for such Services. Note that if you
            elect to receive text messages through the Services, data and message rates may
            apply. Any and all such charges, fees or costs are your sole responsibility. You
            should consult with your wireless carrier to determine what rates, charges, fees
            or costs may apply to your use of the Services.
          </p>
          <p className="mt-3">
            <strong>Paid Services.</strong> Certain of our Services may be subject to payments
            now or in the future (the &ldquo;Paid Services&rdquo;). Please see our{" "}
            <PaidServicesLink /> for a description of the current Paid Services. Please note
            that any payment terms presented to you in the process of using or signing up for
            a Paid Service are deemed part of these Terms. For example, some Paid Services
            will charge a fee for downloading or installing the Services through the App Store
            (as defined below) linked to your specific device. You agree to comply with, and
            your license to use our mobile application is conditioned upon your compliance
            with, such App Store terms and conditions. Any refunds relating to the
            applications or inquiries regarding refunds relating to the applications shall be
            handled solely by the applicable App Store in accordance with such App
            Store&rsquo;s terms and conditions.
          </p>
          <p className="mt-3">
            <strong>Billing.</strong> We use a third-party payment processor (the
            &ldquo;Payment Processor&rdquo;) to bill you through a payment account linked to
            your account on the Services (your &ldquo;Billing Account&rdquo;) for use of the
            Paid Services. The processing of payments will be subject to the terms, conditions
            and privacy policies of the Payment Processor in addition to these Terms.
            Currently, we use Stripe, Inc. as our Payment Processor. You can access
            Stripe&rsquo;s Terms of Service at{" "}
            <a href="https://stripe.com/us/checkout/legal" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">
              https://stripe.com/us/checkout/legal
            </a>{" "}
            and their Privacy Policy at{" "}
            <a href="https://stripe.com/us/privacy" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">
              https://stripe.com/us/privacy
            </a>
            . We are not responsible for any error by, or other acts or omissions of, the
            Payment Processor. By choosing to use Paid Services, you agree to pay us, through
            the Payment Processor, all charges at the prices then in effect for any use of
            such Paid Services in accordance with the applicable payment terms, and you
            authorize us, through the Payment Processor, to charge your chosen payment
            provider (your &ldquo;Payment Method&rdquo;). You agree to make payment using that
            selected Payment Method. We reserve the right to correct any errors or mistakes
            that the Payment Processor makes even if it has already requested or received
            payment.
          </p>
          <p className="mt-3">
            <strong>Payment Method.</strong> The terms of your payment will be based on your
            Payment Method and may be determined by agreements between you and the financial
            institution, credit card issuer or other provider of your chosen Payment Method.
            If we, through the Payment Processor, do not receive payment from you, you agree
            to pay all amounts due on your Billing Account upon demand.
          </p>
          <p className="mt-3">
            <strong>Recurring Billing.</strong> Some of the Paid Services may consist of an
            initial period, for which there is a one-time charge, followed by recurring period
            charges as agreed to by you. By choosing a recurring payment plan, you acknowledge
            that such Services have an initial and recurring payment feature and you accept
            responsibility for all recurring charges prior to cancellation.{" "}
            <strong>
              WE MAY SUBMIT PERIODIC CHARGES (E.G., MONTHLY) WITHOUT FURTHER AUTHORIZATION
              FROM YOU, UNTIL YOU PROVIDE PRIOR NOTICE (RECEIPT OF WHICH IS CONFIRMED BY US)
              THAT YOU HAVE TERMINATED THIS AUTHORIZATION OR WISH TO CHANGE YOUR PAYMENT
              METHOD. SUCH NOTICE WILL NOT AFFECT CHARGES SUBMITTED BEFORE WE REASONABLY COULD
              ACT. TO TERMINATE YOUR AUTHORIZATION OR CHANGE YOUR PAYMENT METHOD, GO TO{" "}
              <AccountSettingsLink>ACCOUNT SETTINGS</AccountSettingsLink>.
            </strong>
          </p>
          <p className="mt-3">
            <strong>Current Information Required.</strong>{" "}
            <strong>
              YOU MUST PROVIDE CURRENT, COMPLETE AND ACCURATE INFORMATION FOR YOUR BILLING
              ACCOUNT. YOU MUST PROMPTLY UPDATE ALL INFORMATION TO KEEP YOUR BILLING ACCOUNT
              CURRENT, COMPLETE AND ACCURATE (SUCH AS A CHANGE IN BILLING ADDRESS, CREDIT CARD
              NUMBER, OR CREDIT CARD EXPIRATION DATE), AND YOU MUST PROMPTLY NOTIFY US OR OUR
              PAYMENT PROCESSOR IF YOUR PAYMENT METHOD IS CANCELED (E.G., FOR LOSS OR THEFT)
              OR IF YOU BECOME AWARE OF A POTENTIAL BREACH OF SECURITY, SUCH AS THE
              UNAUTHORIZED DISCLOSURE OR USE OF YOUR USER NAME OR PASSWORD. CHANGES TO SUCH
              INFORMATION CAN BE MADE AT{" "}
              <AccountSettingsLink>ACCOUNT SETTINGS</AccountSettingsLink>. IF YOU FAIL TO
              PROVIDE ANY OF THE FOREGOING INFORMATION, YOU AGREE THAT WE MAY CONTINUE
              CHARGING YOU FOR ANY USE OF PAID SERVICES UNDER YOUR BILLING ACCOUNT UNLESS YOU
              HAVE TERMINATED YOUR PAID SERVICES AS SET FORTH ABOVE.
            </strong>
          </p>
          <p className="mt-3">
            <strong>Change in Amount Authorized.</strong> If the amount to be charged to your
            Billing Account varies from the amount you preauthorized (other than due to the
            imposition or change in the amount of state sales taxes), you have the right to
            receive, and we shall provide, notice of the amount to be charged and the date of
            the charge before the scheduled date of the transaction. Any agreement you have
            with your payment provider will govern your use of your Payment Method. You agree
            that we may accumulate charges incurred and submit them as one or more aggregate
            charges during or at the end of each billing cycle.
          </p>
          <p className="mt-3">
            <strong>Auto-Renewal for Paid Services.</strong> Unless you opt out of
            auto-renewal, which can be done through your <AccountSettingsLink />, any Paid
            Services you have signed up for will be automatically extended for successive
            renewal periods of the same duration as the subscription term originally selected,
            at the then-current non-promotional rate. To change or resign your Paid Services
            at any time, go to <AccountSettingsLink /> or, for mobile applications, cancel
            your subscription in the subscription management section of the applicable App
            Store. If you terminate a Paid Service, you may use your subscription until the
            end of your then-current term, and your subscription will not be renewed after
            your then-current term expires. However, you will not be eligible for a prorated
            refund of any portion of the subscription fee paid for the then-current
            subscription period.{" "}
            <strong>
              IF YOU DO NOT WANT TO CONTINUE TO BE CHARGED ON A RECURRING MONTHLY BASIS, YOU
              MUST CANCEL THE APPLICABLE PAID SERVICE THROUGH YOUR{" "}
              <AccountSettingsLink>ACCOUNT SETTINGS</AccountSettingsLink> OR TERMINATE YOUR
              QUARTERBACK HEALTH ACCOUNT BEFORE THE END OF THE RECURRING TERM. PAID SERVICES
              CANNOT BE TERMINATED BEFORE THE END OF THE PERIOD FOR WHICH YOU HAVE ALREADY
              PAID, AND EXCEPT AS EXPRESSLY PROVIDED IN THESE TERMS, QUARTERBACK HEALTH WILL
              NOT REFUND ANY FEES THAT YOU HAVE ALREADY PAID.
            </strong>
          </p>
          <p className="mt-3">
            <strong>Reaffirmation of Authorization.</strong> Your non-termination or continued
            use of a Paid Service reaffirms that we are authorized to charge your Payment
            Method for that Paid Service. We may submit those charges for payment and you will
            be responsible for such charges. This does not waive our right to seek payment
            directly from you. Your charges may be payable in advance, in arrears, per usage,
            or as otherwise described when you initially selected to use the Paid Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What if I want to stop using the Services?</h2>
          <p>
            You&rsquo;re free to do that at any time by contacting us at <AdminEmail />;
            please refer to our <PrivacyLink />, as well as the licenses above, to understand
            how we treat information you provide to us after you have stopped using our
            Services.
          </p>
          <p className="mt-3">
            Quarterback Health is also free to terminate (or suspend access to) your use of
            the Services or your account for any reason in our discretion, including your
            breach of these Terms. Quarterback Health has the sole right to decide whether you
            are in violation of any of the restrictions set forth in these Terms.
          </p>
          <p className="mt-3">
            Account termination may result in destruction of any Content associated with your
            account, so keep that in mind before you decide to terminate your account.
          </p>
          <p className="mt-3">
            If you have deleted your account by mistake, contact us immediately at{" "}
            <AdminEmail />. We will try to help, but unfortunately, we can&rsquo;t promise
            that we can recover or restore anything.
          </p>
          <p className="mt-3">
            Provisions that, by their nature, should survive termination of these Terms shall
            survive termination. By way of example, all of the following will survive
            termination: any obligation you have to pay us or indemnify us, any limitations on
            our liability, any terms regarding ownership or intellectual property rights, and
            terms regarding disputes between us, including without limitation the arbitration
            agreement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What about Mobile Applications and In-App Purchases?</h2>
          <p>
            You acknowledge and agree that the availability of our mobile application is
            dependent on the third party stores from which you download the application, e.g.,
            the App Store from Apple or the Android app market from Google (each an &ldquo;App
            Store&rdquo;). Each App Store may have its own terms and conditions to which you
            must agree before downloading mobile applications from such store, including the
            specific terms relating to Apple App Store set forth below. You agree to comply
            with, and your license to use our application is conditioned upon your compliance
            with, such App Store terms and conditions. To the extent such other terms and
            conditions from such App Store are less restrictive than, or otherwise conflict
            with, the terms and conditions of these Terms of Use, the more restrictive or
            conflicting terms and conditions in these Terms of Use apply.
          </p>
          <p className="mt-3">
            Through our mobile applications, you may purchase (&ldquo;In-App Purchase&rdquo;)
            certain goods or features designed to enhance the performance of the Services.
            When you make an In-App Purchase, you are doing so through either the Apple iTunes
            service or the Google Play service and you are agreeing to their respective Terms
            and Conditions, available at{" "}
            <a href="http://www.apple.com/legal/internet-services/itunes/us/terms.html" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">
              http://www.apple.com/legal/internet-services/itunes/us/terms.html
            </a>{" "}
            and{" "}
            <a href="http://play.google.com/intl/en_us/about/play-terms.html" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">
              http://play.google.com/intl/en_us/about/play-terms.html
            </a>
            . Quarterback Health is not a party to any In-App Purchase.
          </p>
          <h3 className="text-base font-semibold text-[#071832] mt-5 mb-2">
            I use the Quarterback Health App available via the Apple App Store – should I know anything about that?
          </h3>
          <p>
            These Terms apply to your use of all the Services, including our iOS applications
            (the &ldquo;Application&rdquo;) available via the Apple, Inc.
            (&ldquo;Apple&rdquo;) App Store, but the following additional terms also apply to
            the Application:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>Both you and Quarterback Health acknowledge that the Terms are concluded between you and Quarterback Health only, and not with Apple, and that Apple is not responsible for the Application or the Content;</li>
            <li>The Application is licensed to you on a limited, non-exclusive, non-transferrable, non-sublicensable basis, solely to be used in connection with the Services for your private, personal, non-commercial use, subject to all the terms and conditions of these Terms as they are applicable to the Services;</li>
            <li>You will only use the Application in connection with an Apple device that you own or control;</li>
            <li>You acknowledge and agree that Apple has no obligation whatsoever to furnish any maintenance and support services with respect to the Application;</li>
            <li>In the event of any failure of the Application to conform to any applicable warranty, including those implied by law, you may notify Apple of such failure; upon notification, Apple&rsquo;s sole warranty obligation to you will be to refund to you the purchase price, if any, of the Application;</li>
            <li>You acknowledge and agree that Quarterback Health, and not Apple, is responsible for addressing any claims you or any third party may have in relation to the Application;</li>
            <li>You acknowledge and agree that, in the event of any third-party claim that the Application or your possession and use of the Application infringes that third party&rsquo;s intellectual property rights, Quarterback Health, and not Apple, will be responsible for the investigation, defense, settlement and discharge of any such infringement claim;</li>
            <li>You represent and warrant that you are not located in a country subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a &ldquo;terrorist supporting&rdquo; country, and that you are not listed on any U.S. Government list of prohibited or restricted parties;</li>
            <li>Both you and Quarterback Health acknowledge and agree that, in your use of the Application, you will comply with any applicable third-party terms of agreement which may affect or be affected by such use; and</li>
            <li>Both you and Quarterback Health acknowledge and agree that Apple and Apple&rsquo;s subsidiaries are third-party beneficiaries of these Terms, and that upon your acceptance of these Terms, Apple will have the right (and will be deemed to have accepted the right) to enforce these Terms against you as the third-party beneficiary hereof.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#071832] mt-8 mb-3">What else do I need to know?</h2>
          <p>
            <strong>Warranty Disclaimer.</strong> Quarterback Health and its licensors,
            suppliers, partners, parent, subsidiaries or affiliated entities, and each of
            their respective officers, directors, members, employees, consultants, contract
            employees, representatives and agents, and each of their respective successors and
            assigns (Quarterback Health and all such parties together, the &ldquo;Quarterback
            Health Parties&rdquo;) make no representations or warranties concerning the
            Services, including without limitation regarding any Content contained in or
            accessed through the Services, and the Quarterback Health Parties will not be
            responsible or liable for the accuracy, copyright compliance, legality, or decency
            of material contained in or accessed through the Services or any claims, actions,
            suits procedures, costs, expenses, damages or liabilities arising out of use of,
            or in any way related to your participation in, the Services. The Quarterback
            Health Parties make no representations or warranties regarding suggestions or
            recommendations of services or products offered or purchased through or in
            connection with the Services.{" "}
            <strong>
              THE SERVICES, AI FEATURES, OUTPUT, AND CONTENT ARE PROVIDED BY QUARTERBACK
              HEALTH (AND ITS LICENSORS AND SUPPLIERS) ON AN &ldquo;AS-IS&rdquo; BASIS,
              WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, WITHOUT
              LIMITATION, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, NON-INFRINGEMENT, OR THAT USE OF THE SERVICES WILL BE UNINTERRUPTED OR
              ERROR-FREE. SOME STATES DO NOT ALLOW LIMITATIONS ON HOW LONG AN IMPLIED WARRANTY
              LASTS, SO THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.
            </strong>
          </p>
          <p className="mt-3">
            <strong>Limitation of Liability.</strong>{" "}
            <strong>
              TO THE FULLEST EXTENT ALLOWED BY APPLICABLE LAW, UNDER NO CIRCUMSTANCES AND
              UNDER NO LEGAL THEORY (INCLUDING, WITHOUT LIMITATION, TORT, CONTRACT, STRICT
              LIABILITY, OR OTHERWISE) SHALL ANY OF THE QUARTERBACK HEALTH PARTIES BE LIABLE
              TO YOU OR TO ANY OTHER PERSON FOR (A) ANY INDIRECT, SPECIAL, INCIDENTAL,
              PUNITIVE OR CONSEQUENTIAL DAMAGES OF ANY KIND, INCLUDING DAMAGES FOR LOST
              PROFITS, BUSINESS INTERRUPTION, LOSS OF DATA, LOSS OF GOODWILL, WORK STOPPAGE,
              ACCURACY OF RESULTS, OR COMPUTER FAILURE OR MALFUNCTION, (B) ANY SUBSTITUTE
              GOODS, SERVICES OR TECHNOLOGY, (C) ANY AMOUNT, IN THE AGGREGATE, IN EXCESS OF
              THE GREATER OF (I) ONE-HUNDRED ($100) DOLLARS OR (II) THE AMOUNTS PAID AND/OR
              PAYABLE BY YOU TO QUARTERBACK HEALTH IN CONNECTION WITH THE SERVICES IN THE
              TWELVE (12) MONTH PERIOD PRECEDING THIS APPLICABLE CLAIM OR (D) ANY MATTER
              BEYOND OUR REASONABLE CONTROL. SOME STATES DO NOT ALLOW THE EXCLUSION OR
              LIMITATION OF INCIDENTAL OR CONSEQUENTIAL OR CERTAIN OTHER DAMAGES, SO THE ABOVE
              LIMITATION AND EXCLUSIONS MAY NOT APPLY TO YOU.
            </strong>
          </p>
          <p className="mt-3">
            <strong>Indemnity.</strong> You agree to indemnify and hold the Quarterback Health
            Parties harmless from and against any and all claims, liabilities, damages (actual
            and consequential), losses and expenses (including attorneys&rsquo; fees) arising
            from or in any way related to any claims relating to (a) your use of the Services
            (including any actions taken by a third party using your account), and (b) your
            violation of these Terms. In the event of such a claim, suit, or action
            (&ldquo;Claim&rdquo;), we will attempt to provide notice of the Claim to the
            contact information we have for your account (provided that failure to deliver
            such notice shall not eliminate or reduce your indemnification obligations
            hereunder).
          </p>
          <p className="mt-3">
            <strong>Assignment.</strong> You may not assign, delegate or transfer these Terms
            or your rights or obligations hereunder, or your Services account, in any way (by
            operation of law or otherwise) without Quarterback Health&rsquo;s prior written
            consent. We may transfer, assign, or delegate these Terms and our rights and
            obligations without consent.
          </p>
          <p className="mt-3">
            <strong>Choice of Law.</strong> These Terms are governed by and will be construed
            under the Federal Arbitration Act, applicable federal law, and the laws of the
            State of Connecticut, without regard to the conflicts of laws provisions thereof.
          </p>
          <p className="mt-3">
            <strong>Arbitration Agreement.</strong> Please read the following ARBITRATION
            AGREEMENT carefully because it requires you to arbitrate certain disputes and
            claims with Quarterback Health and limits the manner in which you can seek relief
            from Quarterback Health. Both you and Quarterback Health acknowledge and agree
            that for the purposes of any dispute arising out of or relating to the subject
            matter of these Terms, Quarterback Health&rsquo;s officers, directors, employees
            and independent contractors (&ldquo;Personnel&rdquo;) are third-party
            beneficiaries of these Terms, and that upon your acceptance of these Terms,
            Personnel will have the right (and will be deemed to have accepted the right) to
            enforce these Terms against you as the third-party beneficiary hereof.
          </p>
          <p className="mt-3">
            <strong>(a) Arbitration Rules; Applicability of Arbitration Agreement.</strong>{" "}
            The parties shall use their best efforts to settle any dispute, claim, question,
            or disagreement arising out of or relating to the subject matter of these Terms
            directly through good-faith negotiations, which shall be a precondition to either
            party initiating arbitration. If such negotiations do not resolve the dispute, it
            shall be finally settled by binding arbitration in Fairfield County. The
            arbitration will proceed in the English language, in accordance with the JAMS
            Streamlined Arbitration Rules and Procedures (the &ldquo;Rules&rdquo;) then in
            effect, by one commercial arbitrator with substantial experience in resolving
            intellectual property and commercial contract disputes. The arbitrator shall be
            selected from the appropriate list of JAMS arbitrators in accordance with such
            Rules. Judgment upon the award rendered by such arbitrator may be entered in any
            court of competent jurisdiction.
          </p>
          <p className="mt-3">
            <strong>(b) Costs of Arbitration.</strong> The Rules will govern payment of all
            arbitration fees. Quarterback Health will pay all arbitration fees for claims less
            than seventy-five thousand ($75,000) dollars. Quarterback Health will not seek its
            attorneys&rsquo; fees and costs in arbitration unless the arbitrator determines
            that your claim is frivolous.
          </p>
          <p className="mt-3">
            <strong>(c) Small Claims Court; Infringement.</strong> Either you or Quarterback
            Health may assert claims, if they qualify, in small claims court in Fairfield
            County or any United States county where you live or work. Furthermore,
            notwithstanding the foregoing obligation to arbitrate disputes, each party shall
            have the right to pursue injunctive or other equitable relief at any time, from
            any court of competent jurisdiction, to prevent the actual or threatened
            infringement, misappropriation or violation of a party&rsquo;s copyrights,
            trademarks, trade secrets, patents or other intellectual property rights.
          </p>
          <p className="mt-3">
            <strong>(d) Waiver of Jury Trial.</strong>{" "}
            <strong>
              YOU AND QUARTERBACK HEALTH WAIVE ANY CONSTITUTIONAL AND STATUTORY RIGHTS TO GO
              TO COURT AND HAVE A TRIAL IN FRONT OF A JUDGE OR JURY.
            </strong>{" "}
            You and Quarterback Health are instead choosing to have claims and disputes
            resolved by arbitration. Arbitration procedures are typically more limited, more
            efficient, and less costly than rules applicable in court and are subject to very
            limited review by a court. In any litigation between you and Quarterback Health
            over whether to vacate or enforce an arbitration award,{" "}
            <strong>YOU AND QUARTERBACK HEALTH WAIVE ALL RIGHTS TO A JURY TRIAL</strong>, and
            elect instead to have the dispute be resolved by a judge.
          </p>
          <p className="mt-3">
            <strong>(e) Waiver of Class or Consolidated Actions.</strong>{" "}
            <strong>
              ALL CLAIMS AND DISPUTES WITHIN THE SCOPE OF THIS ARBITRATION AGREEMENT MUST BE
              ARBITRATED OR LITIGATED ON AN INDIVIDUAL BASIS AND NOT ON A CLASS BASIS. CLAIMS
              OF MORE THAN ONE CUSTOMER OR USER CANNOT BE ARBITRATED OR LITIGATED JOINTLY OR
              CONSOLIDATED WITH THOSE OF ANY OTHER CUSTOMER OR USER.
            </strong>{" "}
            If however, this waiver of class or consolidated actions is deemed invalid or
            unenforceable, neither you nor Quarterback Health is entitled to arbitration;
            instead all claims and disputes will be resolved in a court as set forth in (g)
            below.
          </p>
          <p className="mt-3">
            <strong>(f) Opt-out.</strong> You have the right to opt out of the provisions of
            this Section by sending written notice of your decision to opt out to the
            following address: 20 Glory Road, Weston, Connecticut 06883 postmarked within
            thirty (30) days of first accepting these Terms. You must include (i) your name
            and residence address, (ii) the email address and/or telephone number associated
            with your account, and (iii) a clear statement that you want to opt out of these
            Terms&rsquo; arbitration agreement.
          </p>
          <p className="mt-3">
            <strong>(g) Exclusive Venue.</strong> If you send the opt-out notice in (f),
            and/or in any circumstances where the foregoing arbitration agreement permits
            either you or Quarterback Health to litigate any dispute arising out of or
            relating to the subject matter of these Terms in court, then the foregoing
            arbitration agreement will not apply to either party, and both you and Quarterback
            Health agree that any judicial proceeding (other than small claims actions) will
            be brought in the state or federal courts located in, respectively, Fairfield
            County, or the federal district in which that county falls.
          </p>
          <p className="mt-3">
            <strong>(h) Severability.</strong> If the prohibition against class actions and
            other claims brought on behalf of third parties contained above is found to be
            unenforceable, then all of the preceding language in this Arbitration Agreement
            section will be null and void. This arbitration agreement will survive the
            termination of your relationship with Quarterback Health.
          </p>
          <p className="mt-3">
            <strong>Miscellaneous.</strong> You will be responsible for paying, withholding,
            filing, and reporting all taxes, duties, and other governmental assessments
            associated with your activity in connection with the Services, provided that the
            Quarterback Health may, in its sole discretion, do any of the foregoing on your
            behalf or for itself as it sees fit. The failure of either you or us to exercise,
            in any way, any right herein shall not be deemed a waiver of any further rights
            hereunder. If any provision of these Terms are found to be unenforceable or
            invalid, that provision will be limited or eliminated, to the minimum extent
            necessary, so that these Terms shall otherwise remain in full force and effect and
            enforceable. You and Quarterback Health agree that these Terms are the complete
            and exclusive statement of the mutual understanding between you and Quarterback
            Health, and that these Terms supersede and cancel all previous written and oral
            agreements, communications and other understandings relating to the subject
            matter of these Terms. You hereby acknowledge and agree that you are not an
            employee, agent, partner, or joint venture of Quarterback Health, and you do not
            have any authority of any kind to bind Quarterback Health in any respect
            whatsoever.
          </p>
          <p className="mt-3">
            Except as expressly set forth in the sections above regarding the Apple
            Application and the arbitration agreement, you and Quarterback Health agree there
            are no third-party beneficiaries intended under these Terms.
          </p>
        </section>
      </div>
    </>
  );
}
