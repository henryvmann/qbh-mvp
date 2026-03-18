import ProviderCard from './_components/ProviderCard';
import { supabaseAdmin } from '../../lib/supabase-server';

async function getProvidersWithFacts() {
  const demoUserId = process.env.QBH_DEMO_USER_ID;
  if (!demoUserId) return [];

  // 1️⃣ Get providers
  const { data: providers, error } = await supabaseAdmin
    .from('providers')
    .select('id,name,status,guessed_portal_brand,guessed_portal_confidence')
    .eq('user_id', demoUserId)
    .order('created_at', { ascending: true });

  if (error || !providers) return [];

  // 2️⃣ Get portal facts (timeline)
  const providerIds = providers.map((p: any) => p.id);

  const { data: facts } = await supabaseAdmin
    .from('portal_facts')
    .select('*')
    .in('provider_id', providerIds)
    .order('created_at', { ascending: false });

const factsByProvider: Record<string, any[]> = {};
facts?.forEach((f: any) => {
  if (!factsByProvider[f.provider_id]) factsByProvider[f.provider_id] = [];
  if (factsByProvider[f.provider_id].length < 8) {
    factsByProvider[f.provider_id].push(f);
  }
});

  // 3️⃣ Get visits (charges truth)
  const { data: visits } = await supabaseAdmin
    .from('provider_visits')
    .select('provider_id, visit_date')
    .eq('user_id', demoUserId);

  // 4️⃣ Get calendar events (future truth)
  const { data: events } = await supabaseAdmin
    .from('calendar_events')
    .select('provider_id, start_at, status')
    .eq('user_id', demoUserId);

  return providers.map((p: any) => {
    const providerFacts = factsByProvider[p.id] || [];

    // LAST VISIT
    const providerVisits = (visits || []).filter(v => v.provider_id === p.id);
    const lastVisit = providerVisits.sort(
      (a, b) =>
        new Date(b.visit_date).getTime() -
        new Date(a.visit_date).getTime()
    )[0];

    // UPCOMING APPOINTMENT
    const now = new Date();
    const upcoming = (events || []).some(e =>
      e.provider_id === p.id &&
      e.status === 'confirmed' &&
      new Date(e.start_at) > now
    );

    // FOLLOW-UP RULE
    const followUpNeeded =
      !!lastVisit &&
      new Date(`${lastVisit.visit_date}T00:00:00Z`).getTime() <
        (Date.now() - 180 * 24 * 60 * 60 * 1000) &&
      !upcoming;

    return {
      ...p,
      facts: providerFacts,
      followUpNeeded
    };
  });
}

export default async function ProvidersPage() {
  const providers = await getProvidersWithFacts();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Providers</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>Phase 3: Follow-up approval</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {providers.map((p: any) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>
    </main>
  );
}