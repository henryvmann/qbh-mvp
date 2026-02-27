export default function PortalTimeline({ facts }: { facts: any[] }) {
  if (!facts || facts.length === 0) {
    return (
      <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
        No portal activity yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        Portal Activity
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {facts.slice(0, 5).map((fact) => (
          <div
            key={fact.id}
            style={{
              padding: 10,
              border: '1px solid #333',
              borderRadius: 8,
              fontSize: 13
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {fact.fact_type.replace('_', ' ').toUpperCase()}
            </div>
            <div style={{ color: '#aaa' }}>
              {fact.fact_date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}