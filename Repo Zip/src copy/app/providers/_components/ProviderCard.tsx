'use client';

import PortalGuess from './PortalGuess';
import PortalTimeline from './PortalTimeline';
import { useRouter } from 'next/navigation';



export default function ProviderCard({ provider }: { provider: any }) {
  async function approveFollowUp(providerId: string) {
    const router = useRouter();
    const res = await fetch('/api/followup/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId }),
    });

    // For now we just reload to re-fetch server-rendered data.
    // If endpoint doesn't exist yet, you'll see a 404 in the terminal/network tab.
    if (res.ok) router.refresh();
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{provider.name}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Status: {provider.status}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            followUpNeeded: {String(provider.followUpNeeded)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {provider.followUpNeeded && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              border: '1px solid #aa4444',
              borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>⚠️ Follow-up likely needed</div>

            <button style={{ marginTop: 8 }} onClick={() => approveFollowUp(provider.id)}>
              Approve Call
            </button>
          </div>
        )}

        <PortalGuess provider={provider} />
        <PortalTimeline facts={provider.facts} />
      </div>
    </div>
  );
}