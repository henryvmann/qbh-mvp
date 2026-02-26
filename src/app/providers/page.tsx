import ProviderCard from './_components/ProviderCard';
import { supabaseAdmin } from '../../lib/supabase-server';

async function getProviders() {
  const demoUserId = process.env.QBH_DEMO_USER_ID;

  if (!demoUserId) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('providers')
    .select('id,name,status,guessed_portal_brand,guessed_portal_confidence')
    .eq('user_id', demoUserId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getProviders error:', error);
    return [];
  }

  return data ?? [];
}

export default async function ProvidersPage() {
  const providers = await getProviders();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Providers</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Phase 1: provider list + portal guess/connect/sync actions
      </p>

      {providers.length === 0 ? (
        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, color: '#666' }}>
          No providers loaded yet. Check QBH_DEMO_USER_ID + seeded rows in Supabase.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map((p: any) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </main>
  );
}