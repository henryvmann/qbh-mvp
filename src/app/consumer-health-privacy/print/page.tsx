"use client";

import { useEffect } from "react";
import ConsumerHealthPrivacyContent from "../ConsumerHealthPrivacyContent";

const LAST_UPDATED = "May 31, 2026";

export default function ConsumerHealthPrivacyPrintPage() {
  useEffect(() => {
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
          footer { display: none !important; }
          a[href^="#"]::after { content: ""; }
        }
        body { background: white; }
      `}</style>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-6 py-10 print:py-0 print:px-0">
          <div className="print-hide mb-6 flex items-center justify-between text-xs">
            <span className="text-[#4F5F73]">
              Printing the Quarterback Health Consumer Health Data Privacy Policy. If the print
              dialog didn&rsquo;t open, use your browser&rsquo;s print command.
            </span>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-[#1677FF] px-3 py-1.5 font-semibold text-white"
            >
              Print
            </button>
          </div>
          <ConsumerHealthPrivacyContent lastUpdated={LAST_UPDATED} />
        </div>
      </div>
    </>
  );
}
