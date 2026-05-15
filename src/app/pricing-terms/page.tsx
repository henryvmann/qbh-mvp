/**
 * /pricing-terms — Paid Services terms referenced from the Terms of
 * Use. Counsel recommended keeping pricing and refund mechanics on a
 * separate page so we can update them without amending the Terms of
 * Use (which would require notifying every user). The Terms link to
 * this page.
 *
 * Contents:
 *  - Current plans and prices
 *  - Fee change notice policy (14 days, email + in-app)
 *  - Refund policy (no partial refunds; cancel at period end)
 *  - App Store / Google Play refund deferral
 */

import Link from "next/link";
import LegalFooter from "../../components/brand/LegalFooter";

export const metadata = {
  title: "Paid Services Terms — Quarterback Health",
  description: "Pricing, fee changes, and refund policy for Quarterback Health subscriptions.",
};

const LAST_UPDATED = "May 14, 2026";

export default function PricingTermsPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-[#071832] mb-2">Paid Services Terms</h1>
        <p className="text-sm text-[#4F5F73] mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-[#3A3F4B] text-sm leading-relaxed">
          <section>
            <p>
              These Paid Services Terms describe the pricing, billing, fee changes, and refund
              policies for Quarterback Health subscriptions. They are incorporated by reference
              into our{" "}
              <Link href="/terms" className="text-[#1677FF] underline">
                Terms of Use
              </Link>
              . If anything in these Paid Services Terms conflicts with the Terms of Use, the
              Terms of Use control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">1. Current Plans</h2>
            <p className="mb-4">
              Quarterback Health offers a free tier and two paid subscription tiers. Plan
              details and entitlements are shown at{" "}
              <Link href="/billing" className="text-[#1677FF] underline">
                getquarterback.com/billing
              </Link>{" "}
              and may change as described in Section 3.
            </p>
            <div className="overflow-hidden rounded-xl border border-[#E5EAF2] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[#F0F2F5] text-left">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold text-[#071832]">Plan</th>
                    <th scope="col" className="px-4 py-2 font-semibold text-[#071832]">Price</th>
                    <th scope="col" className="px-4 py-2 font-semibold text-[#071832]">Billing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  <tr>
                    <td className="px-4 py-3 font-medium">QB Free</td>
                    <td className="px-4 py-3">$0</td>
                    <td className="px-4 py-3">No charge</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">QB Solo</td>
                    <td className="px-4 py-3">$24 / month</td>
                    <td className="px-4 py-3">Monthly, auto-renewing</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">QB Family</td>
                    <td className="px-4 py-3">$49 / month</td>
                    <td className="px-4 py-3">Monthly, auto-renewing</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[#4F5F73]">
              Prices shown are in U.S. dollars and do not include any applicable taxes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">2. Auto-Renewal and Cancellation</h2>
            <p className="mb-3">
              Paid subscriptions renew automatically at the end of each billing period at the
              then-current price for your plan, unless you cancel before the renewal date. Your
              cancellation will take effect at the end of your current billing period — you will
              keep access through the end of the period you have already paid for, and you will
              not be charged again.
            </p>
            <p>
              You can cancel at any time from{" "}
              <Link href="/billing" className="text-[#1677FF] underline">
                Account Settings
              </Link>{" "}
              with a single click. You can also resume a canceled subscription before the
              current period ends to prevent it from lapsing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">3. Fee Changes</h2>
            <p>
              We may change the price of a plan or introduce new fees. If we do, we will notify
              you by email and in-app notice at least{" "}
              <strong>14 days before the change takes effect</strong>. Continued use of the paid
              service after the change effective date means you accept the new fee. If you do
              not want to accept a fee change, you can cancel before the change takes effect and
              your subscription will end at the close of your current billing period at the
              original price.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">4. Refund Policy</h2>
            <p className="mb-3">
              We do not offer refunds for partial billing periods. If you cancel mid-period, you
              keep access through the end of that period and no further charges occur. We do not
              prorate refunds for unused time.
            </p>
            <p>
              We may, at our sole discretion, issue refunds outside this policy in the case of
              billing errors (for example, duplicate charges or charges after a documented
              cancellation). To request a billing-error refund, email{" "}
              <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">
                admin@getquarterback.com
              </a>{" "}
              with the date of the charge and a short description of the issue.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">5. Purchases Through App Stores</h2>
            <p>
              If you purchased a Quarterback Health subscription through the Apple App Store or
              the Google Play Store, your subscription, billing, and refund terms with respect
              to that purchase are governed by the applicable store&rsquo;s terms — not by these
              Paid Services Terms. Refund requests for App Store / Google Play purchases must be
              made through the store. We do not have the ability to issue refunds for purchases
              made through these channels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">6. Taxes</h2>
            <p>
              You are responsible for any applicable taxes associated with your purchase. Where
              required by law, we will collect and remit sales tax or VAT on top of the listed
              price.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#071832] mb-3">7. Questions</h2>
            <p>
              For any questions about pricing, billing, or refunds, email us at{" "}
              <a href="mailto:admin@getquarterback.com" className="text-[#1677FF] underline">
                admin@getquarterback.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
      <LegalFooter mode="light" />
    </div>
  );
}
