import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-20">

        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0F1520] ring-1 ring-white/8 grid place-items-center">
              <span className="text-sm font-semibold text-[#5DE8C5]">
                QB
              </span>
            </div>

            <div>
              <div className="text-sm text-[#6B85A8]">
                Quarterback Health
              </div>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-sm underline underline-offset-4 text-[#6B85A8] hover:text-[#EFF4FF]"
          >
            Dashboard
          </Link>
        </header>

        <section className="mt-16">
          <h1 className="text-5xl tracking-tight">
            Your healthcare, handled.
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-[#6B85A8]">
            Quarterback tracks your providers, surfaces what's overdue,
            and schedules appointments on your behalf.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/connect"
              className="rounded-2xl bg-[#5DE8C5] px-6 py-3 text-[#080C14] font-medium shadow-sm"
            >
              Connect your account
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-[#0F1520] px-6 py-3 ring-1 ring-white/8 shadow-sm text-[#EFF4FF]"
            >
              View dashboard
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
