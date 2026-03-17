function getFactMeta(fact: any): { icon: string; title: string; subtitle: string } {
  const json = fact.fact_json || {};

  switch (fact.fact_type) {
    case 'portal_connected':
      return {
        icon: '🔗',
        title: 'Portal connected',
        subtitle: json.portal || 'Portal account linked',
      };
    case 'portal_token_received':
      return {
        icon: '🔐',
        title: 'Portal authorized',
        subtitle: json.patient || 'Access granted',
      };
    case 'patient_demographics':
      return {
        icon: '👤',
        title: json.display_name || 'Patient synced',
        subtitle: json.birth_date || 'Demographics imported',
      };
    case 'booking_confirmed':
      return {
        icon: '📅',
        title: 'Booking confirmed',
        subtitle: 'Appointment added to calendar',
      };
    case 'appointment_scheduled':
      return {
        icon: '🗓️',
        title: 'Appointment scheduled',
        subtitle: json.timezone || 'Scheduling event created',
      };
    case 'call_attempt':
      return {
        icon: '📞',
        title: 'Call attempt',
        subtitle: json.note || 'Follow-up call initiated',
      };
    case 'lab_result':
      return {
        icon: '🧪',
        title: json.title || 'Lab result',
        subtitle: json.source || 'Portal update',
      };
    case 'message':
      return {
        icon: '💬',
        title: json.title || 'New message',
        subtitle: json.source || 'Portal message received',
      };
    default:
      return {
        icon: '•',
        title: String(fact.fact_type || 'activity')
          .replaceAll('_', ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        subtitle: fact.fact_date || '',
      };
  }
}

function formatFactDate(value: string | null | undefined): string {
  if (!value) return '';

  const parts = String(value).split('-');
  if (parts.length !== 3) return String(value);

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const factDay = new Date(year, month, day);
  if (Number.isNaN(factDay.getTime())) return String(value);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.round(
    (today.getTime() - factDay.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return factDay.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

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
        Health Timeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {facts.slice(0, 5).map((fact) => {
          const meta = getFactMeta(fact);

          return (
            <div
              key={fact.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 10,
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.title}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  {meta.subtitle}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
                  {formatFactDate(fact.fact_date)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}