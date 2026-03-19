import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-20">

        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 grid place-items-center">
              <span className="text-sm font-semibold text-[#8B9D83]">
                QBH
              </span>
            </div>

            <div>
              <div className="text-sm text-neutral-600">
                Quarterback Health
              </div>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-sm underline underline-offset-4 text-neutral-700"
          >
            Dashboard
          </Link>
        </header>

        <section className="mt-16">
          <h1
            className="text-5xl tracking-tight"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Your healthcare, handled.
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-neutral-700">
            Quarterback tracks your providers, surfaces what’s overdue,
            and schedules appointments on your behalf.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/connect"
              className="rounded-2xl bg-[#8B9D83] px-6 py-3 text-white shadow-sm"
            >
              Connect your account
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-white px-6 py-3 ring-1 ring-black/5 shadow-sm"
            >
              View dashboard
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}