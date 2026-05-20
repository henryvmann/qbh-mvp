import Link from "next/link";
import PrivacyContent from "./PrivacyContent";
import LegalFooter from "../../components/brand/LegalFooter";

export const metadata = {
  title: "Privacy Policy — Quarterback Health",
  description: "How Quarterback Health collects, uses, and protects your information.",
};

const LAST_UPDATED = "April 25, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-end">
          <Link
            href="/privacy/print"
            target="_blank"
            className="text-xs font-medium text-[#1677FF] underline"
          >
            Print this policy
          </Link>
        </div>
        <PrivacyContent lastUpdated={LAST_UPDATED} />
        <div className="mt-12 pt-6 border-t border-[#E5EAF2] text-center">
          <a href="/" className="text-sm text-[#1677FF] hover:underline">&larr; Back to Quarterback Health</a>
        </div>
      </div>
      <LegalFooter mode="light" />
    </div>
  );
}
