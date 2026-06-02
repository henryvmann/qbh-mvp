import Link from "next/link";
import ConsumerHealthPrivacyContent from "./ConsumerHealthPrivacyContent";
import LegalFooter from "../../components/brand/LegalFooter";

export const metadata = {
  title: "Consumer Health Data Privacy Policy — Quarterback Health",
  description:
    "Supplemental Consumer Health Data Privacy Policy for Connecticut, Nevada, and Washington residents.",
};

const LAST_UPDATED = "May 31, 2026";

export default function ConsumerHealthPrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-end">
          <Link
            href="/consumer-health-privacy/print"
            target="_blank"
            className="text-xs font-medium text-[#1677FF] underline"
          >
            Print this policy
          </Link>
        </div>
        <ConsumerHealthPrivacyContent lastUpdated={LAST_UPDATED} />
        <div className="mt-12 pt-6 border-t border-[#E5EAF2] text-center">
          <a href="/" className="text-sm text-[#1677FF] hover:underline">
            &larr; Back to Quarterback Health
          </a>
        </div>
      </div>
      <LegalFooter mode="light" />
    </div>
  );
}
