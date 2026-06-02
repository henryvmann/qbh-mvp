/**
 * Consumer Health Data Privacy Policy body. Shared by
 * /consumer-health-privacy and /consumer-health-privacy/print.
 *
 * Source: counsel's "Quarterback AI LLC - Consumer Health Data
 * Privacy Policy [5-29-26].docx". Verbatim — do not paraphrase or
 * restructure without counsel sign-off.
 */

import Link from "next/link";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-[#071832] mt-10 mb-3 scroll-mt-24">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3">{children}</p>;
}

export default function ConsumerHealthPrivacyContent({ lastUpdated }: { lastUpdated: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-[#071832] mb-2 print:text-2xl">
        Quarterback AI Consumer Health Data Privacy Policy
      </h1>
      <p className="text-sm text-[#4F5F73] mb-8 print:mb-6">Effective date: {lastUpdated}</p>

      <div className="text-[#3A3F4B] text-sm leading-relaxed">
        <P>
          This Consumer Health Data Privacy Policy (&ldquo;Health Data Privacy Policy&rdquo;) applies to Quarterback AI&rsquo;s collection of consumer personal information defined as &ldquo;Consumer Health Data&rdquo; (described below) under certain U.S. state consumer privacy laws, including the Connecticut Data Privacy Act, Nevada&rsquo;s Consumer Health Data Privacy Law, and the Washington My Health My Data Act, each as amended (collectively, and as applicable, &ldquo;Consumer Health Privacy Laws&rdquo;). This Health Data Privacy Policy supplements Quarterback AI&rsquo;s Privacy Policy available at{" "}
          <Link href="/privacy" className="text-[#1677FF] underline">
            getquarterback.com/privacy
          </Link>{" "}
          (&ldquo;Privacy Policy&rdquo;) and any capitalized but not defined terms in this Health Data Privacy Policy will have the definitions set forth in the Privacy Policy or Consumer Health Privacy Laws.
        </P>

        <H2 id="collection">Collection of Consumer Health Data</H2>
        <P>
          &ldquo;Consumer Health Data&rdquo; is personal information that is linked or reasonably linkable to a consumer and that identifies, or that Quarterback AI uses to identify, a consumer&rsquo;s past, present, or future physical or mental health status. Consumer Health Data does not include information that is publicly available, de-identified, or aggregated. The Consumer Health Data we collect may differ depending on how you interact with us.
        </P>

        <H2 id="categories">Categories of Consumer Health Data We Collect</H2>
        <P>
          Quarterback AI only collects Consumer Health Data as needed to provide you with the products and services you have requested, to support your use of the Quarterback AI platform, or with your explicit consent. The Quarterback AI platform is designed to help patients and caregivers organize and manage the full scope of their healthcare, including provider relationships, appointments, medical records, lab results, medications, and related health information, in a single, secure hub. In connection with these services, we may collect the following categories of Consumer Health Data:
        </P>
        <ul className="list-disc pl-6 space-y-2">
          <li>Individual health conditions, treatments, diseases, or diagnoses, including conditions, diagnoses, and health history you upload, enter, or authorize us to retrieve through the platform (such as via connected provider records or health system integrations);</li>
          <li>Social, psychological, behavioral, and medical interventions, including information about care plans, behavioral health services, or medical treatments tracked or stored through your Quarterback AI account;</li>
          <li>Health-related surgeries or procedures, including surgical history or upcoming procedures that you record, upload, or share through the platform;</li>
          <li>Use or purchase of prescribed medication, including prescription details, medication names, dosages, refill history, and pharmacy information that you enter or that is imported from connected health records or providers;</li>
          <li>Bodily functions, vital signs, symptoms, or measurements, including biometric readings, symptom logs, or other health measurements you manually enter or sync to your account from connected health devices or wearables;</li>
          <li>Diagnoses or diagnostic testing, treatment, or medication information, including lab results, diagnostic test results, imaging reports, and related treatment records you upload or that are retrieved through provider or health system connections;</li>
          <li>Gender-affirming care information, to the extent such information is contained in health records, appointment notes, or other health data you store, upload, or authorize us to retrieve on your behalf;</li>
          <li>Reproductive or sexual health information, to the extent such information is contained in health records, lab results, or provider notes you store, upload, or authorize us to retrieve through the platform;</li>
          <li>Genetic data, to the extent you upload or store genetic test results or related reports through your Quarterback AI account;</li>
          <li>Data that identifies a consumer seeking health care services, including information derived from your use of the Quarterback AI platform to search for, schedule, or manage appointments with healthcare providers; and</li>
          <li>Any information that Quarterback AI or its processors derive or extrapolate from non-health information that is used to associate or identify you with any of the Consumer Health Data categories described above (such as inferences drawn from your platform usage patterns, appointment scheduling behavior, or document access history).</li>
        </ul>

        <H2 id="sources">Categories of Sources of Consumer Health Data</H2>
        <P>
          As described in the Categories of Sources of Personal Data section of{" "}
          <Link href="/privacy#sources" className="text-[#1677FF] underline">
            Quarterback AI&rsquo;s Privacy Policy
          </Link>
          , we may collect Personal Information, including Consumer Health Data, directly from you (when you use our products and services), and from third parties.
        </P>

        <H2 id="purposes">Our Purposes for Collecting and Using Consumer Health Data</H2>
        <P>
          We may collect, use, disclose, or otherwise process your Consumer Health Data as reasonably necessary for various purposes as described in the Our Commercial and Business Purposes for Collecting Personal Information and Other Permitted Purposes for Processing Personal Information sections of our{" "}
          <Link href="/privacy#commercial-purposes" className="text-[#1677FF] underline">Privacy Policy</Link>
          , but primarily to provide you with products and services as you have requested or authorized.
        </P>
        <P>
          We do not engage in geofencing around stores that provide in-person health care services to: (1) identify or track you when seeking health care services; (2) collect your Consumer Health Data; or (3) send notifications, messages, or advertisements to you related to your Consumer Health Data or health care services.
        </P>

        <H2 id="disclose">How We Disclose Your Consumer Health Data</H2>
        <P>
          As further described in our{" "}
          <Link href="/privacy#how-we-disclose" className="text-[#1677FF] underline">
            Privacy Policy
          </Link>
          , we may disclose your Consumer Health Data to certain third parties and our affiliates, which may include:
        </P>
        <P>
          <strong>Service Providers.</strong> We may disclose your Consumer Health Data to service providers, analytics partners, business partners, and vendors to provide and improve our Services to you.
        </P>
        <P>
          <strong>Health Partners.</strong> With your permission and at your direction, Quarterback AI is configured to share data about you with healthcare providers, clinicians, pharmacies, insurers, caregivers, or other health-related third parties that you elect to engage or designate.
        </P>
        <P>
          <strong>Other Parties.</strong> We may disclose your Consumer Health Data to other parties that you explicitly gave us consent to do so.
        </P>

        <H2 id="rights">Consumer Health Data Rights</H2>
        <P>
          If you are a Connecticut, Nevada, or Washington resident, you may have rights with respect to your Consumer Health Data as described below. Your rights may be subject to certain conditions and exceptions under Consumer Health Privacy Laws.
        </P>
        <P>
          <strong>Access and Portability:</strong> You have the right to request confirmation of whether or not we are processing your Consumer Health Data and to access your Consumer Health Data and request a copy of your Consumer Health Data in a machine-readable format, to the extent technically feasible. If you are a Nevada or Washington resident, you may also request a list of all third parties and affiliates to whom we have disclosed or sold your Consumer Health Data and their contact information.
        </P>
        <P>
          <strong>Correction:</strong> You have the right to correct inaccuracies in your Consumer Health Data, to the extent such correction is appropriate in consideration of the nature of such data and our purposes of processing your Consumer Health Data.
        </P>
        <P>
          <strong>Deletion:</strong> You have the right to request that we delete the Consumer Health Data that we have collected about you.
        </P>
        <P>
          <strong>Opt-Out of Sale, Targeted Advertising, and Profiling:</strong> You have the right to opt-out of sale and/or processing of your Consumer Health Data for targeted advertising and profiling purposes, however, we do not conduct such activities using your Consumer Health Data.
        </P>
        <P>
          <strong>Withdraw Consent:</strong> You have the right to withdraw consent from us collecting and disclosing your Consumer Health Data.
        </P>
        <P>
          <strong>Nondiscrimination:</strong> You have the right not to be discriminated against for exercising your rights as described above.
        </P>
        <P>
          <strong>Appeal:</strong> If we refuse to take action on your request within a reasonable period of time after receiving your request, you may appeal our decision. If we deny your appeal, you have the right to contact your state&rsquo;s Attorney General (CT, NV and WA).
        </P>
        <P>
          To exercise your rights, you must send us a request that (1) provides sufficient information to allow us to verify that you are the person about whom we have collected Personal Data, and (2) describes your request in sufficient detail to allow us to understand, evaluate and respond to it. Each request that meets both of these criteria will be considered a &ldquo;Valid Request.&rdquo; We may not respond to requests that do not meet these criteria.
        </P>
        <P>You may submit a Valid Request by using the following methods:</P>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email us at: <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a></li>
          <li>Submit a form <Link href="/privacy/request" className="text-[#1677FF] underline">here</Link>.</li>
        </ul>
        <P>
          If you have any questions about this section or whether any of the following rights apply to you, please contact us at{" "}
          <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">admin@getquarterback.com</a>.
        </P>
      </div>
    </>
  );
}
