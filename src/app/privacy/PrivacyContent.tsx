/**
 * Privacy Policy body. Shared by /privacy and /privacy/print.
 *
 * Source: counsel's "Quarterback AI, LLC - Privacy Policy [5-29-26].docx".
 * Verbatim — do not paraphrase or restructure without counsel sign-off.
 */

import Link from "next/link";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-[#071832] mt-10 mb-3 scroll-mt-24">
      {children}
    </h2>
  );
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-[#071832] mt-6 mb-2 scroll-mt-24">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3">{children}</p>;
}

export default function PrivacyContent({ lastUpdated }: { lastUpdated: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-[#071832] mb-2 print:text-2xl">Privacy Policy</h1>
      <p className="text-sm text-[#4F5F73] mb-8 print:mb-6">Effective date: {lastUpdated}</p>

      <div className="text-[#3A3F4B] text-sm leading-relaxed">
        <P>
          At Quarterback AI, we take your privacy seriously. Please read this Privacy Policy to learn how we treat your personal data. By using or accessing our Services in any manner, you acknowledge that you accept the practices and policies outlined below, and you hereby consent that we will collect, use and share your information as described in this Privacy Policy.
        </P>
        <P>
          Remember that your use of Quarterback AI&rsquo;s Services is at all times subject to our{" "}
          <Link href="/terms" className="text-[#1677FF] underline">Terms of Use</Link>, which incorporates this Privacy Policy. Any terms we use in this Policy without defining them have the definitions given to them in the Terms of Use. You may print a copy of this Privacy Policy by{" "}
          <Link href="/privacy/print" className="text-[#1677FF] underline">clicking here</Link>.
        </P>
        <P>
          As we continually work to improve our Services, we may need to change this Privacy Policy from time to time. Upon such changes, we will alert you to material changes by placing a notice on the Quarterback AI website, by sending you an email and/or by some other means. Please note that if you&rsquo;ve opted not to receive legal notice emails from us (or you haven&rsquo;t provided us with your email address), those legal notices will still govern your use of the Services, and you are still responsible for reading and understanding them. If you use the Services after any changes to the Privacy Policy have been posted, that means you agree to all of the changes.
        </P>
        <P>
          For individuals in Connecticut, Washington or Nevada, please refer to the{" "}
          <Link href="/consumer-health-privacy" className="text-[#1677FF] underline">
            Quarterback AI Consumer Health Data Privacy Policy
          </Link>{" "}
          for additional information about the processing of your consumer health data.
        </P>

        <H2 id="toc">Privacy Policy Table of Contents</H2>
        <ul className="list-disc pl-6 space-y-1">
          <li><a href="#what-this-covers" className="text-[#1677FF] underline">What this Privacy Policy Covers</a></li>
          <li><a href="#personal-data" className="text-[#1677FF] underline">Personal Data</a>
            <ul className="list-[circle] pl-6 mt-1 space-y-1">
              <li><a href="#categories" className="text-[#1677FF] underline">Categories of Personal Data We Collect</a></li>
              <li><a href="#commercial-purposes" className="text-[#1677FF] underline">Our Commercial or Business Purposes for Collecting or Disclosing Personal Data</a></li>
              <li><a href="#other-purposes" className="text-[#1677FF] underline">Other Permitted Purposes for Processing Personal Data</a></li>
              <li><a href="#sources" className="text-[#1677FF] underline">Categories of Sources of Personal Data</a></li>
              <li><a href="#how-we-disclose" className="text-[#1677FF] underline">How We Disclose Your Personal Data</a></li>
            </ul>
          </li>
          <li><a href="#messages-recording" className="text-[#1677FF] underline">Messages, Recording and Transcription Services</a></li>
          <li><a href="#tracking" className="text-[#1677FF] underline">Tracking Tools, Advertising and Opt-Out</a></li>
          <li><a href="#security" className="text-[#1677FF] underline">Data Security</a></li>
          <li><a href="#children" className="text-[#1677FF] underline">Personal Data of Children</a></li>
          <li><a href="#state-rights" className="text-[#1677FF] underline">U.S. State Privacy Rights</a></li>
          <li><a href="#exercising" className="text-[#1677FF] underline">Exercising Your Rights under U.S. State Privacy Laws</a></li>
          <li><a href="#contact" className="text-[#1677FF] underline">Contact Information</a></li>
        </ul>

        <H2 id="what-this-covers">What this Privacy Policy Covers</H2>
        <P>
          Quarterback AI is a technology platform dedicated to empowering your healthcare experience with personalized tools and compassionate support. We are not a medical provider and do not provide medical advice. The Personal Data that you provide to Quarterback AI through the Services, therefore, is not considered &ldquo;protected health information&rdquo; and is not subject to the Health Insurance Portability and Accountability Act (&ldquo;HIPAA&rdquo;). &ldquo;Personal Data&rdquo; means any information that identifies or relates to a particular individual and also includes information referred to as &ldquo;personally identifiable information&rdquo; or &ldquo;personal information&rdquo; or &ldquo;sensitive personal information&rdquo; under applicable data privacy laws, rules or regulations.
        </P>

        <H2 id="personal-data">Personal Data</H2>

        <H3 id="categories">Categories of Personal Data We Collect</H3>
        <P>This chart details the categories of Personal Data that we collect and have collected over the past 12 months:</P>
        <div className="overflow-x-auto -mx-2 print:mx-0">
          <table className="w-full text-xs border-collapse my-4 print:text-[10px]">
            <thead>
              <tr className="bg-[#E5EAF2]">
                <th className="border border-[#CBD3DE] p-2 text-left align-top font-semibold">Category of Personal Data (and Examples)</th>
                <th className="border border-[#CBD3DE] p-2 text-left align-top font-semibold">Business or Commercial Purpose(s) for Collection</th>
                <th className="border border-[#CBD3DE] p-2 text-left align-top font-semibold">Categories of Third Parties With Whom We Disclose this Personal Data</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr>
                <td className="border border-[#CBD3DE] p-2">Profile or Contact Data such as first and last name, email, phone number, and mailing address.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Corresponding with You.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers. Health Partners, at your direction.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Device/IP Data such as IP address, device ID, and domain server.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Corresponding with You.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Payment Data such as payment card information, billing address, and related information.</td>
                <td className="border border-[#CBD3DE] p-2">Providing the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Services Providers (specifically, our payment processing partners).</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Web Analytics such as web page interactions and referring webpage/source through which users accessed the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Marketing the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Consumer Demographic Data such as age and/or date and gender.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Marketing the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Health Data such as medical conditions, weight, health or exercise activity monitoring, food and nutrition logging and habits, lifestyle and goals, health insurance related information, and similar information.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Marketing the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers. Health Partners, at your direction.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Sensory Data such as photos of you that you chose to provide.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Messages, Recording and Transcription Services Data, such as participant identifiers, phone numbers, email addresses, or usernames, and the content of your communications as discussed more fully below.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Credentialing Data such as your Quarterback AI login credentials or information generated when the Services are accessed via a third-party (such as Google SSO).</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers. Parties You Authorize, Access or Authenticate.</td>
              </tr>
              <tr>
                <td className="border border-[#CBD3DE] p-2">Other Identifying Information that You Voluntarily Choose to Provide such as emails or other communications you send us, as well as other information you provide.</td>
                <td className="border border-[#CBD3DE] p-2">Providing, Customizing and Improving the Services. Corresponding with You.</td>
                <td className="border border-[#CBD3DE] p-2">Service Providers. Health Providers, at your direction.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <H3 id="commercial-purposes">Our Commercial or Business Purposes for Collecting Personal Data</H3>
        <p className="font-semibold mt-3 mb-1">Providing, Customizing and Improving the Services</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Creating and managing your account or other user profiles.</li>
          <li>Processing orders or other transactions.</li>
          <li>Providing you with the products, services or information you request, which may involve disclosing certain data to our Health Partners at your direction.</li>
          <li>Meeting or fulfilling the reason you provided the information to us.</li>
          <li>Providing support and assistance for the Services.</li>
          <li>Improving the Services, including testing, research, internal analytics and product development and improvement, [including, without limitation, Quarterback AI&rsquo;s current and future artificial intelligence and/or machine learning algorithms and models].</li>
          <li>Personalizing the Services, website content and communications based on your preferences.</li>
          <li>Doing fraud protection, security and debugging.</li>
          <li>Carrying out other business purposes stated when collecting your Personal Data or as otherwise set forth in applicable data privacy laws.</li>
        </ul>
        <p className="font-semibold mt-4 mb-1">Marketing the Services</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Marketing and selling the Services.</li>
        </ul>
        <p className="font-semibold mt-4 mb-1">Corresponding with You</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Responding to correspondence that we receive from you, contacting you when necessary or requested, and sending you information about Quarterback AI or the Services.</li>
          <li>Sending emails and other communications according to your preferences.</li>
        </ul>

        <H3 id="other-purposes">Other Permitted Purposes for Processing Personal Data</H3>
        <P>
          In addition, each of the above referenced categories of Personal Data may be collected, used, and disclosed with the government, including law enforcement, or other parties to meet certain legal requirements and enforcing legal terms including: fulfilling our legal obligations under applicable law, regulation, court order or other legal process, such as preventing, detecting and investigating security incidents and potentially illegal or prohibited activities; protecting the rights, property or safety of you, Quarterback AI or another party; enforcing any agreements with you; responding to claims that any posting or other content violates third-party rights; and resolving disputes.
        </P>
        <P>
          We will not collect additional categories of Personal Data or use the Personal Data we collected for materially different, unrelated or incompatible purposes without providing you notice or obtaining your consent.
        </P>

        <H3 id="sources">Categories of Sources of Personal Data</H3>
        <P>We collect Personal Data about you from the following categories of sources:</P>
        <p className="font-semibold mt-3 mb-1">You</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>When you provide such information directly to us.</li>
          <li>When you create an account or use our interactive tools and Services.</li>
          <li>When you voluntarily provide information in free-form text boxes through the Services or through responses to surveys or questionnaires.</li>
          <li>When you send us an email or otherwise contact us.</li>
          <li>When you use the Services and such information is collected automatically.</li>
          <li>Through Cookies (defined in the &ldquo;Tracking Tools, Advertising and Opt-Out&rdquo; section below).</li>
          <li>If you download our mobile application or use a location-enabled browser, we may receive information about your location and mobile device, as applicable.</li>
          <li>If you download and install applications we make available, we may receive and collect information transmitted from your computing device for the purpose of providing you the relevant Services, such as information regarding when you are logged on and available to receive updates or alert notices.</li>
          <li>When you provide health records to us, either directly or through integration with your Electronic Health Record (EHR) system. With your authorization, we collect health records about you, which may include your medical history, diagnoses, conditions, treatment and visit records, lab and test results, prescriptions and medications, immunizations, allergies, and provider notes. You may submit these records to us directly through the Services (for example, by uploading documents or entering information), or you may authorize us to retrieve them on your behalf from your EHR provider or other healthcare source through a connected integration. We collect, use, and disclose this information solely as described in this Privacy Policy and the{" "}
            <Link href="/consumer-health-privacy" className="text-[#1677FF] underline">Quarterback AI Consumer Health Data Privacy Policy</Link>{" "}
            referenced above, and we will not share your health records with third parties for their own purposes without your consent, except as required by law.</li>
        </ul>
        <p className="font-semibold mt-4 mb-1">Third Parties</p>
        <p className="italic mt-2 mb-1">Vendors</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>We may use analytics providers to analyze how you interact and engage with the Services, including how you interact with our websites, applications, products, Services, advertisements, communications, or the third parties that help us provide you with customer support.</li>
          <li>We may use vendors to obtain information to generate leads and create user profiles.</li>
        </ul>
        <p className="italic mt-3 mb-1">Third-Party Credentials</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>If you provide your third-party account credentials, such as your social network account credentials, to us or otherwise sign in to the Services through a third-party site or service, some content and/or information in those accounts may be transmitted into your account with us.</li>
        </ul>

        <H3 id="how-we-disclose">How We Disclose Your Personal Data</H3>
        <P>
          We disclose your Personal Data to the categories of service providers and other parties listed in this section. For more information, please refer to the state-specific sections below.
        </P>
        <P>
          <strong>Service Providers.</strong> These parties help us provide the Services or perform business functions on our behalf. They include:
        </P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Hosting, technology and communication providers.</li>
          <li>Analytics providers for web traffic or usage of our Services.</li>
          <li>Security and fraud prevention consultants.</li>
          <li>Support and customer service vendors.</li>
          <li>Vendors that leverage artificial intelligence, machine learning, or other technology to process content submitted to the Quarterback AI platform, provide you with the Services, and provide you with intelligent features. Such third-party vendors are contractually prohibited from using your data to train their artificial intelligence or machine learning models.</li>
        </ul>
        <P>
          <strong>Advertising Partners.</strong> These parties help us market our services and provide you with other offers that may be of interest to you. They include:
        </P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Ad networks.</li>
          <li>Marketing providers.</li>
          <li>Analytics providers that assist with our Interest-Based Advertisements.</li>
        </ul>
        <P>
          <strong>Health Partners.</strong> With your permission and at your direction, Quarterback AI is configured to share data about you with healthcare providers, clinicians, pharmacies, insurers, caregivers, or other health-related third parties that you elect to engage or designate. The categories and scope of data shared in each case are determined by the specific provider you select and the choices you make at the time of disclosure, and we will only share such data to the extent necessary to facilitate the services or interaction you have requested.
        </P>
        <p className="font-semibold mt-4 mb-1">Legal Obligations</p>
        <P>
          We may disclose any Personal Data that we collect with third parties in conjunction with any of the activities set forth under &ldquo;Other Permitted Purposes for Processing Personal Data&rdquo; section above.
        </P>
        <p className="font-semibold mt-4 mb-1">Business Transfers</p>
        <P>
          All of your Personal Data that we collect may be transferred to a third party if we undergo a merger, acquisition, bankruptcy or other transaction in which that third party assumes control of our business (in whole or in part).
        </P>
        <p className="font-semibold mt-4 mb-1">Data that is Not Personal Data</p>
        <P>
          We may create aggregated, de-identified or anonymized data from the Personal Data we collect, including by removing information that makes the data personally identifiable to a particular user. We may use such aggregated, de-identified or anonymized data and disclose it with third parties for our lawful business purposes, including to analyze, build and improve the Services and promote our business, provided that we will not disclose such data in a manner that could identify you.
        </P>

        <H2 id="messages-recording">Messages, Recording and Transcription Services</H2>
        <P>
          Our Services may offer features that allow you to enable Quarterback AI to send messages, place calls, and initiate communications on your behalf (&ldquo;Messages&rdquo;), as well as features that enable Quarterback AI to record or transcribe communications (&ldquo;Recording and Transcription Services&rdquo;). Your use of the Messages feature and the Recording and Transcription Services is entirely optional and within your sole discretion.
        </P>
        <P>
          When you choose to use these features, we may collect: (i) the content of messages, calls, and other communications you send, receive, or initiate through the Services; (ii) audio recordings and transcripts of communications you elect to record or transcribe; (iii) associated metadata, such as the date, time, duration, participant identifiers (for example, phone numbers, email addresses, or usernames), and delivery or call status; and (iv) any Personal Data, Health Data, or Sensitive Personal Data you choose to include within such communications or recordings.
        </P>
        <P>
          We use the data collected through the Messages and Recording and Transcription Services to: (i) deliver, operate, maintain, and improve these features; (ii) facilitate the communications you have requested; (iii) generate transcripts, summaries, and related outputs; (iv) provide support and respond to your requests; (v) maintain the security and integrity of the Services and detect or prevent fraud or misuse; and (vi) comply with our legal obligations. Consistent with our practice for other content submitted through the Services, we do not use the content of your messages, recordings, or transcripts to train third-party artificial intelligence or machine learning models, and our third-party vendors are contractually prohibited from doing so.
        </P>
        <P>
          We disclose data generated through these features only as described in the &ldquo;How We Disclose Your Personal Data&rdquo; section above, including to Service Providers (such as telecommunications, messaging, transcription, and hosting vendors) that help us deliver the features, to Health Partners at your direction, to the intended recipients of your communications, and as otherwise required or permitted by law. We do not &ldquo;sell&rdquo; or &ldquo;share&rdquo; this data for cross-context behavioral advertising or targeted advertising.
        </P>
        <p className="font-semibold mt-4 mb-1">Consent and Your Choices</p>
        <P>
          Use of the Messages feature and the Recording and Transcription Services is opt-in and within your sole discretion. You may enable, disable, or discontinue use of these features at any time through your account settings. By enabling these features, you consent to Quarterback AI&rsquo;s collection, use, storage, and disclosure of the data described above for the purposes set forth in this Privacy Policy and, where applicable, the Quarterback AI Consumer Health Data Privacy Policy referenced above.
        </P>
        <P>
          Recording and transcription of communications may be subject to federal and state wiretapping, eavesdropping, and two-party (or all-party) consent laws (including those in California, Connecticut, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Pennsylvania, and Washington). You are solely responsible for understanding and complying with any laws applicable to your recording or transcription of communications, including obtaining the consent of all participants where required. Where we provide such functionality, Quarterback AI may make available audible or visual notifications to participants when a recording or transcription is in progress; however, you remain responsible for ensuring that any recording or transcription complies with applicable law.
        </P>

        <H2 id="tracking">Tracking Tools, Advertising, and Opt-Out</H2>
        <P>
          The Services use cookies and similar technologies such as pixel tags, web beacons, clear GIFs and JavaScript (collectively, &ldquo;Cookies&rdquo;) to enable our servers to recognize your web browser, tell us how and when you visit and use our Services, analyze trends, learn about our user base and operate and improve our Services. Cookies are small pieces of data&ndash; usually text files &ndash; placed on your computer, tablet, phone or similar device when you use that device to access our Services. We may also supplement the information we collect from you with information received from third parties, including third parties that have placed their own Cookies on your device(s).
        </P>
        <P>
          Please note that because of our use of Cookies, the Services do not support &ldquo;Do Not Track&rdquo; requests sent from a browser at this time.
        </P>
        <P>We use the following types of Cookies:</P>
        <P>
          <strong>Essential Cookies.</strong> Essential Cookies are required for providing you with features or services that you have requested. For example, certain Cookies enable you to log into secure areas of our Services. Disabling these Cookies may make certain features and services unavailable.
        </P>
        <P>
          <strong>Functional Cookies.</strong> Functional Cookies are used to record your choices and settings regarding our Services, maintain your preferences over time and recognize you when you return to our Services. These Cookies help us to personalize our content for you, greet you by name and remember your preferences (for example, your choice of language or region).
        </P>
        <P>
          <strong>Performance/Analytical Cookies.</strong> Performance/Analytical Cookies allow us to understand how visitors use our Services. They do this by collecting information about the number of visitors to the Services, what pages visitors view on our Services and how long visitors are viewing pages on the Services. Performance/Analytical Cookies also help us measure the performance of our advertising campaigns in order to help us improve our campaigns and the Services&rsquo; content for those who engage with our advertising.
        </P>
        <P>
          You can decide whether or not to accept Cookies through your internet browser&rsquo;s settings. Most browsers have an option for turning off the Cookie feature, which will prevent your browser from accepting new Cookies, as well as (depending on the sophistication of your browser software) allow you to decide on acceptance of each new Cookie in a variety of ways. You can also delete all Cookies that are already on your device. If you do this, however, you may have to manually adjust some preferences every time you visit our website and some of the Services and functionalities may not work.
        </P>
        <P>
          To explore what Cookie settings are available to you or to modify your preferences with respect to Cookies, you can access your Cookie management settings by clicking the &ldquo;Cookie settings&rdquo; link in the footer of any page. To find out more information about Cookies generally, including information about how to manage and delete Cookies, please visit{" "}
          <a href="http://www.allaboutcookies.org/" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">http://www.allaboutcookies.org/</a>.
        </P>

        <H2 id="security">Data Security</H2>
        <P>
          We seek to protect your Personal Data from unauthorized access, use and disclosure using appropriate physical, technical, organizational and administrative security measures based on the type of Personal Data and how we are processing that data. You should also help protect your data by appropriately selecting and protecting your password and/or other sign-on mechanism; limiting access to your computer or device and browser; and signing off after you have finished accessing your account. Although we work to protect the security of your account and other data that we hold in our records, please be aware that no method of transmitting data over the internet or storing data is completely secure.
        </P>
        <p className="font-semibold mt-4 mb-1">Data Retention</p>
        <P>
          We retain Personal Data about you for as long as necessary to provide you with our Services or to perform our business or commercial purposes for collecting your Personal Data. When establishing a retention period for specific categories of data, we consider who we collected the data from, our need for the Personal Data, why we collected the Personal Data, and the sensitivity of the Personal Data. In some cases we retain Personal Data for longer, if doing so is necessary to comply with our legal obligations, resolve disputes or collect fees owed, or is otherwise permitted or required by applicable law, rule or regulation. We may further retain information in an anonymous or aggregated form where that information would not identify you personally.
        </P>
        <P>For example:</P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Account profile and credentials: for the life of your account, then for up to 90 days after deletion.</li>
          <li>Payment data: through the end of the active subscription, then as required for tax and accounting purposes (currently 7 years).</li>
          <li>Device/IP and security logs: 90 days.</li>
          <li>Health records you upload or authorize us to retrieve: for the life of your account, deletable on request.</li>
          <li>Call recordings and transcripts (when you have enabled the Messages and Recording/Transcription Services): 2 years from the date of the call, deletable on request.</li>
        </ul>

        <H2 id="children">Personal Data of Children</H2>
        <P>
          We do not knowingly collect or solicit Personal Data from children under 13 years of age; if you are a child under the age of 13, please do not attempt to register for or otherwise use the Services or send us any Personal Data. If we learn we have collected Personal Data from a child under 13 years of age, we will delete that information as quickly as possible. If you believe that a child under 13 years of age may have provided Personal Data to us, please contact us at{" "}
          <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a>.
        </P>

        <H2 id="state-rights">U.S. State Privacy Rights</H2>
        <P>
          If you reside in certain U.S. states such as California, Colorado, Connecticut, Delaware, Iowa, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, and Virginia you may have certain rights afforded to you (as described below) depending on your state of residence. Please see the &lsquo;Exercising Your Rights under U.S. State Privacy Laws&rsquo; section below for instructions regarding how to exercise these rights. Please note that we may process Personal Data of our customers&rsquo; end users or employees in connection with our provision of certain services to our customers. If we are processing your Personal Data as a service provider, you should contact the entity that collected your Personal Data in the first instance to address your rights with respect to such data. Please note that your rights may be subject to certain conditions or exceptions in accordance with applicable U.S. State Privacy Laws.
        </P>
        <P>
          If you have any questions about this section or whether any of the following rights apply to you, please contact us at{" "}
          <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a>.
        </P>
        <P>
          <strong>Access:</strong> You may have the right to request confirmation of or access to the Personal Data that we process about you. You can also request access to a portable copy of your Personal Data. If you are an Oregon resident, you also have the right to request a list of specific third parties, other than natural persons, to which we have disclosed your Personal Data.
        </P>
        <P>
          <strong>Deletion:</strong> You may have the right to request that we delete the Personal Data that we have collected about you.
        </P>
        <P>
          <strong>Correction:</strong> You may have the right to request that we correct any inaccurate Personal Data we have collected about you.
        </P>
        <P>
          <strong>Portability:</strong> You may have the right to request a copy of your Personal Data in a machine-readable format, to the extent technically feasible.
        </P>
        <p className="font-semibold mt-4 mb-1">&ldquo;Selling,&rdquo; &ldquo;Sharing,&rdquo; or &ldquo;Targeted Advertising&rdquo;</p>
        <P>
          Depending on your state of residence, you may have the right to opt out from the &ldquo;sale,&rdquo; &ldquo;share,&rdquo; or disclosure of your Personal Data for the purposes of targeted advertising. These or similar terms may be defined differently depending the applicable U.S. State Privacy Law. Quarterback AI has not sold or shared your Personal Data, or disclosed your Personal Data for purposes of targeted advertising, in the preceding 12 months.
        </P>
        <p className="font-semibold mt-4 mb-1">Processing of Sensitive Personal Data</p>
        <P>
          As needed, we may reach out to you to provide us with Personal Data that may be deemed &ldquo;sensitive&rdquo; under certain U.S. State Privacy Laws (&ldquo;Sensitive Personal Data&rdquo;). The categories of Sensitive Personal Data we collect and our purposes for collecting such Sensitive Personal Data is described in the &lsquo;Categories of Personal Data We Collect&rsquo; section above.
        </P>
        <P>
          Depending on your state of residence, you may either have the right to opt-in, the right to opt-out, or if you are a California resident, the right to limit our use of your Sensitive Personal Data to permitted purposes, by following the instructions in the &ldquo;Exercising Your Rights under U.S. State Privacy Laws&rdquo; section. If you are a California resident, please note that our use and disclosure of Sensitive Personal Data are limited to the permitted purposes set forth in section 7027(m) of the CCPA regulations and, therefore, we do not offer a way for you to submit such a request.
        </P>
        <P>
          Please note that limiting the amount of health or other Sensitive Personal Data you provide to us may reduce the level of personalization available to you and result in a less tailored experience with the Services.
        </P>
        <p className="font-semibold mt-4 mb-1">Automated Decision Making and Profiling</p>
        <P>
          Depending on the state of your residence, you may have the right to opt-out the use of automated decision making technology or from the processing of your Personal Data for the purposes of profiling in furtherance of decisions that produce legal or similarly significant effects to you, if applicable. However, we do not process your Personal Data in this manner.
        </P>
        <p className="font-semibold mt-4 mb-1">Anti-Discrimination</p>
        <P>
          We will not discriminate against you for exercising your rights under applicable privacy laws. We will not deny you our goods or services, charge you different prices or rates, or provide you a lower quality of goods and services if you exercise your rights under applicable privacy laws. However, we may offer different tiers of our Services as allowed by applicable data privacy laws with varying prices, rates or levels of quality of the goods or services you receive related to the value of Personal Data that we receive from you.
        </P>
        <p className="font-semibold mt-4 mb-1">Other State-Specific Privacy Rights</p>
        <P>
          Under California Civil Code Sections 1798.83-1798.84, California residents are entitled to contact us to prevent disclosure of Personal Data to third parties for such third parties&rsquo; direct marketing purposes; in order to submit such a request, please contact us at{" "}
          <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a>. However, we do not process your Personal Data in this manner.
        </P>
        <P>
          Your browser may offer you a &ldquo;Do Not Track&rdquo; option, which allows you to signal to operators of websites and web applications and services that you do not wish such operators to track certain of your online activities over time and across different websites. Our Services do not support Do Not Track requests at this time. To find out more about &ldquo;Do Not Track,&rdquo; you can visit{" "}
          <a href="http://www.allaboutdnt.com" target="_blank" rel="noopener noreferrer" className="text-[#1677FF] underline">www.allaboutdnt.com</a>.
        </P>
        <P>
          Please note that we do not currently sell your Personal Data as sales are defined in Nevada Revised Statutes Chapter 603A.
        </P>

        <H2 id="exercising">Exercising Your Rights under U.S. State Privacy Laws</H2>
        <P>
          To exercise the rights described in this Privacy Policy, you or your Authorized Agent (if applicable and as defined below), must send us a request that (1) provides sufficient information to allow us to verify that you are the person about whom we have collected Personal Data (such as your Contact or Profile Data), and (2) describes your request in sufficient detail to allow us to understand, evaluate and respond to it. Each request that meets both of these criteria will be considered a &ldquo;Valid Request.&rdquo; We may not respond to requests that do not meet these criteria. We will only use Personal Data provided in a Valid Request to verify your identity and complete your request. You do not need an account to submit a Valid Request.
        </P>
        <P>
          We will work to respond to your Valid Request within the time period required by applicable privacy laws. We will not charge you a fee for making a Valid Request unless your Valid Request(s) is excessive, repetitive or manifestly unfounded. If we determine that your Valid Request warrants a fee, we will notify you of the fee and explain that decision before completing your request.
        </P>
        <p className="font-semibold mt-4 mb-1">Request to Access, Delete, Correct</p>
        <P>As applicable, you may submit a Valid Request for your right to access, delete, correct, or obtain a copy of your Personal Data described in this Privacy Policy by using the following methods:</P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email us at: <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a></li>
          <li>Submit a form <Link href="/privacy/request" className="text-[#1677FF] underline">here</Link>.</li>
        </ul>
        <P>
          If you are a California, Colorado, Connecticut, Delaware, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey Oregon, or Texas resident, you may also authorize an agent (an &ldquo;Authorized Agent&rdquo;) to exercise your rights on your behalf. To do this, you must provide your Authorized Agent with written permission to exercise your rights on your behalf, and we may request a copy of this written permission from your Authorized Agent when they make a request on your behalf.
        </P>
        <p className="font-semibold mt-4 mb-1">Appealing a Denial</p>
        <P>
          If you are a Colorado, Connecticut, Delaware, Iowa, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, or Virginia resident and we refuse to take action on your request within a reasonable period of time after receiving your request in accordance with this section, you may appeal our decision. In such appeal, you must (1) provide sufficient information to allow us to verify that you are the person about whom the original request pertains and to identify the original request, and (2) provide a description of the basis of your appeal. Please note that your appeal will be subject to your rights and obligations afforded to you under the State Privacy Laws (as applicable). We will respond to your appeal within the time period required under the applicable law. You can submit a Verified Request to appeal by the following methods:
        </P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email us at: <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a> (title must include &ldquo;[STATE OF RESIDENCE] Appeal&rdquo;)</li>
          <li>Submit a form <Link href="/privacy/request" className="text-[#1677FF] underline">here</Link>.</li>
        </ul>
        <P>
          If we deny your appeal, you have the right to contact the Attorney General of your State.
        </P>

        <H2 id="contact">Contact Information</H2>
        <P>
          If you have any questions or comments about this Privacy Policy, the ways in which we collect and use your Personal Data or your choices and rights regarding such collection and use, please do not hesitate to contact us at:
        </P>
        <ul className="list-disc pl-6 space-y-1">
          <li><a href="https://www.getquarterback.com" className="text-[#1677FF] underline">https://www.getquarterback.com</a></li>
          <li><a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a></li>
        </ul>
      </div>
    </>
  );
}
