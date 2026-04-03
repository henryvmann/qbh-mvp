import Link from "next/link";

export const metadata = {
  title: "Caregivers • QBH",
  description:
    "Coordinate care with trusted people, roles, and visibility controls (coming soon).",
};

const features = [
  {
    title: "Share access",
    description:
      "Give trusted people visibility into your care — from upcoming appointments to medication lists — on your terms.",
    icon: (
      <svg
        className="h-5 w-5 text-[#D4A843]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
    ),
  },
  {
    title: "Coordinate care",
    description:
      "Manage who handles what across your household — from scheduling appointments to picking up prescriptions.",
    icon: (
      <svg
        className="h-5 w-5 text-[#D4A843]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    ),
  },
  {
    title: "Stay informed",
    description:
      "Get updates when appointments are booked or changed, so everyone involved in care stays on the same page.",
    icon: (
      <svg
        className="h-5 w-5 text-[#D4A843]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
    ),
  },
];

export default function CaregiversPage() {
  return (
    <main className="min-h-screen bg-[#0B1120] text-[#EFF4FF]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#EFF4FF]">
              Caregivers
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#6B85A8]">
              Coordinate health tasks across your household — sharing
              visibility, delegating work, and keeping the right people in the
              loop.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-[#131B2E] px-4 py-2 text-sm font-medium text-[#6B85A8] shadow-sm hover:bg-[#162030]"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Coming Soon Header */}
        <section className="mt-8 rounded-2xl bg-[#131B2E] p-6 ring-1 ring-[#1E2B45]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4A843]/15">
              <svg
                className="h-5 w-5 text-[#D4A843]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#EFF4FF]">
                Coming soon
              </h2>
              <p className="mt-1 text-sm text-[#6B85A8]">
                We are building caregiver tools so trusted people can help
                manage health without losing control of privacy.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl bg-[#131B2E] p-6 ring-1 ring-[#1E2B45]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4A843]/15">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#EFF4FF]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B85A8]">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* Interested Footer */}
        <section className="mt-6 rounded-2xl bg-[#131B2E] p-6 ring-1 ring-[#1E2B45]">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4A843]/15">
              <svg
                className="h-4 w-4 text-[#D4A843]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#EFF4FF]">
                Interested? Let us know.
              </p>
              <p className="mt-1 text-sm text-[#6B85A8] leading-relaxed">
                Caregiver features are actively in development. Your feedback
                helps us prioritize what to build first — reach out anytime
                through your dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
