'use client';

import { useState } from 'react';

const BRANDS = ['mychart', 'athena', 'healow', 'followmyhealth', 'mock_portal_a', 'mock_portal_b'];

export default function PortalGuess({ provider }: { provider: any }) {
  const [brand, setBrand] = useState(provider.guessed_portal_brand ?? '');
  const [tenant, setTenant] = useState('');
  const [msg, setMsg] = useState('');

  async function connect(selectedBrand: string) {
    setMsg('Connecting…');
    const res = await fetch('/api/portal/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider_id: provider.id,
        portal_brand: selectedBrand,
        portal_tenant: tenant || null,
        mode: selectedBrand.startsWith('mock_') ? 'mock' : 'real',
      }),
    });
    setMsg(res.ok ? 'Connected.' : `Error: ${res.status}`);
  }

  async function sync(selectedBrand: string) {
    setMsg('Syncing…');
    const res = await fetch('/api/portal/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider_id: provider.id, portal_brand: selectedBrand }),
    });
    setMsg(res.ok ? 'Synced.' : `Error: ${res.status}`);
  }

  return (
    <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Portal guess</div>

      <div style={{ fontSize: 13, marginBottom: 10 }}>
        Guess: <b>{provider.guessed_portal_brand ?? '—'}</b>{' '}
        <span style={{ color: '#666' }}>
          ({provider.guessed_portal_confidence ? Math.round(provider.guessed_portal_confidence) : '—'}% confident)
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button disabled={!provider.guessed_portal_brand} onClick={() => connect(provider.guessed_portal_brand)}>
          Accept guess → Connect
        </button>
        <button disabled={!provider.guessed_portal_brand} onClick={() => sync(provider.guessed_portal_brand)}>
          Sync now
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Select portal…</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="tenant (optional)" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={!brand} onClick={() => connect(brand)}>
          Connect selected
        </button>
        <button disabled={!brand} onClick={() => sync(brand)}>
          Sync selected
        </button>
        <span style={{ fontSize: 13, color: '#666' }}>{msg}</span>
      </div>
    </div>
  );
}