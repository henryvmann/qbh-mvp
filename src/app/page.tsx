import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0B1120] text-[#EFF4FF]">
      {/* Decorative circle */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-white/10"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-20">
        <div
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: "#D4A843" }}
        >
          QBH &#10022; Your Health Ally
        </div>

        <h1 className="mt-6 text-4xl font-light tracking-tight sm:text-5xl">
          Your healthcare, handled.
        </h1>

        <p className="mt-4 max-w-xl text-lg text-[#6B85A8]">
          You don&apos;t have to manage this alone. QB keeps track, follows up,
          and handles the details so you don&apos;t have to.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: "#D4A843", color: "#0B1120" }}
          >
            Get started &rarr;
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#131B2E] px-8 py-3.5 text-sm font-medium text-[#EFF4FF] shadow-sm"
          >
            View dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
