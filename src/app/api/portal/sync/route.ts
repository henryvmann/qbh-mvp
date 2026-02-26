import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { provider_id, portal_brand } = body ?? {};

  if (!provider_id || !portal_brand) {
    return NextResponse.json(
      { ok: false, error: 'provider_id and portal_brand are required' },
      { status: 400 }
    );
  }

  const userId = process.env.QBH_DEMO_USER_ID;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'QBH_DEMO_USER_ID not set' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10); // YYYY-MM-DD

  // 1) update last_sync_at on the matching connection (if it exists)
  const { error: updErr } = await supabaseAdmin
    .from('portal_connections')
    .update({ last_sync_at: nowIso })
    .eq('user_id', userId)
    .eq('provider_id', provider_id)
    .eq('portal_brand', portal_brand);

  // If no connection row exists yet, we still allow "sync" for demo speed:
  // We’ll create a connection in mock mode automatically.
  if (updErr) {
    // fallback upsert
    const { error: upsertErr } = await supabaseAdmin
      .from('portal_connections')
      .upsert(
        {
          user_id: userId,
          provider_id,
          portal_brand,
          status: portal_brand.startsWith('mock_') ? 'mock' : 'connected',
          last_sync_at: nowIso,
        },
        { onConflict: 'user_id,provider_id,portal_brand' }
      );

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
    }
  }

  // 2) insert a few demo facts
  const facts = [
    {
      user_id: userId,
      provider_id,
      fact_type: 'appointment',
      fact_date: today,
      fact_json: { title: 'Upcoming appointment', source: portal_brand, when: nowIso },
    },
    {
      user_id: userId,
      provider_id,
      fact_type: 'message',
      fact_date: today,
      fact_json: { title: 'New portal message', source: portal_brand, received_at: nowIso },
    },
    {
      user_id: userId,
      provider_id,
      fact_type: 'lab_result',
      fact_date: today,
      fact_json: { title: 'Lab result posted', source: portal_brand, posted_at: nowIso },
    },
  ];

  const { error: insErr } = await supabaseAdmin.from('portal_facts').insert(facts);

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, facts_written: facts.length, last_sync_at: nowIso });
}