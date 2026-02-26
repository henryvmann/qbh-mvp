import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { provider_id, portal_brand, portal_tenant, mode } = body ?? {};

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

  const status = mode === 'mock' ? 'mock' : 'connected';

  const { data, error } = await supabaseAdmin
    .from('portal_connections')
    .upsert(
      {
        user_id: userId,
        provider_id,
        portal_brand,
        portal_tenant: portal_tenant ?? null,
        status,
      },
      { onConflict: 'user_id,provider_id,portal_brand' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, connection: data });
}