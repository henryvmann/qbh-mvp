import Link from "next/link";
import TermsContent from "./TermsContent";
import LegalFooter from "../../components/brand/LegalFooter";

export const metadata = {
  title: "Terms of Use — Quarterback Health",
  description: "Terms and conditions for using Quarterback Health.",
};

const EFFECTIVE_DATE = "May 20, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-end">
          <Link
            href="/terms/print"
            target="_blank"
            className="text-xs font-medium text-[#1677FF] underline"
          >
            Print these terms
          </Link>
        </div>
        <TermsContent effectiveDate={EFFECTIVE_DATE} />
        <div className="mt-12 pt-6 border-t border-[#E5EAF2] text-center">
          <a href="/" className="text-sm text-[#1677FF] hover:underline">&larr; Back to Quarterback Health</a>
        </div>
      </div>
      <LegalFooter mode="light" />
    </div>
  );
}
