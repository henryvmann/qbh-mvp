"use client";

/**
 * /privacy/print — printable rendering of the Privacy Policy.
 * Counsel's placeholder for "[INSERT LINK THAT LAUNCHES PRINTABLE
 * VERSION]" points here. Auto-fires window.print() on mount and
 * strips chrome via print stylesheet.
 */

import { useEffect } from "react";
import PrivacyContent from "../PrivacyContent";

const LAST_UPDATED = "April 25, 2026";

export default function PrivacyPrintPage() {
  useEffect(() => {
    // Slight delay so layout settles before the print dialog opens.
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.6in; }
          body { background: white !important; }
          .print-hide { display: none !important; }
          a { color: black !important; text-decoration: none !important; }
          a[href^="http"]::after, a[href^="mailto:"]::after {
            content: " (" attr(href) ")";
            font-size: 90%;
            color: #444;
          }
          /* Strip the global LegalFooter from print */
          footer { display: none !important; }
          /* Strip the legacy entity prefixes */
          a[href^="#"]::after { content: ""; }
        }
        body { background: white; }
      `}</style>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-6 py-10 print:py-0 print:px-0">
          <div className="print-hide mb-6 flex items-center justify-between text-xs">
            <span className="text-[#4F5F73]">
              Printing the Quarterback Health Privacy Policy. If the print dialog didn&rsquo;t
              open, use your browser&rsquo;s print command.
            </span>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-[#1677FF] px-3 py-1.5 font-semibold text-white"
            >
              Print
            </button>
          </div>
          <PrivacyContent lastUpdated={LAST_UPDATED} />
        </div>
      </div>
    </>
  );
}
