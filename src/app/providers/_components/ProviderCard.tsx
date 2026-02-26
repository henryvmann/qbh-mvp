'use client';

import PortalGuess from './PortalGuess';

export default function ProviderCard({ provider }: { provider: any }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{provider.name}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Status: {provider.status}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PortalGuess provider={provider} />
      </div>
    </div>
  );
}