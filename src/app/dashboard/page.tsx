// src/app/dashboard/page.tsx

import ProviderCard from "../../components/qbh/ProviderCard";
import { getDashboardProvidersForUser } from "../../lib/QBH/queries/dashboard";

type SearchParams = { [key: string]: string | string[] | undefined };
type PageProps = { searchParams?: Promise<SearchParams> };

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const userIdFromQuery = firstString(sp.user_id);
  const userIdFromEnv = (process.env.QBH_DEMO_USER_ID || "").trim();
  const userId = (userIdFromQuery || userIdFromEnv || "").trim();

  const snapshots = await getDashboardProvidersForUser(userId);

  const total = snapshots.length;
  const followUps = snapshots.filter((s) => s.followUpNeeded).length;
  const upcoming = snapshots.filter((s) => Boolean(s.futureConfirmedEvent)).length;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* Top bar */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-slate-900">
              Health Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Providers, status, and actions — all derived from Supabase.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-black/5">
              <div className="font-medium text-slate-900">Providers</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{total}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-black/5">
              <div className="font-medium text-slate-900">Need follow-up</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{followUps}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-black/5">
              <div className="font-medium text-slate-900">Upcoming</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{upcoming}</div>
            </div>

            {userId ? (
              <div className="rounded-2xl bg-white/50 px-4 py-3 text-xs text-slate-600 ring-1 ring-black/5">
                <div className="font-medium text-slate-900">Demo mode</div>
                <div className="mt-1 max-w-[260px] truncate font-mono text-[11px]">
                  {userId}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {snapshots.map((s) => (
            <ProviderCard key={s.provider.id} snapshot={s} />
          ))}
        </div>
      </div>
    </main>
  );
}