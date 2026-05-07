"use client";

import { useState } from "react";
import { T } from "../brand";

type Candidate = {
  name: string;
  phone: string;
  address: string | null;
};

type Props = {
  candidates: Candidate[];
  providerName: string;
  onPick: (cand: Candidate) => Promise<void>;
};

// Prompt that appears when discovery returned multiple confident
// name-matches in the user's state and we couldn't pin a single
// phone. User picks the right local practice; Kate has the right
// number to call.
//
// One-tap confirmation (not data entry). Kate-voice copy: "I found a
// few — which is yours?" not "Please confirm your provider's phone."
export default function PhonePicker({ candidates, providerName, onPick }: Props) {
  const [picking, setPicking] = useState<number | null>(null);

  function formatPhoneDisplay(e164: string): string {
    const digits = e164.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return e164;
  }

  return (
    <div
      style={{
        background: "rgba(22,119,255,0.06)",
        border: `1px solid rgba(22,119,255,0.18)`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 4,
            alignSelf: "stretch",
            background: T.electric,
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.lightText, lineHeight: 1.45, marginBottom: 10 }}>
            I found {candidates.length} places that could be{" "}
            <strong>{providerName}</strong>. Which is yours?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidates.map((c, i) => (
              <button
                key={i}
                type="button"
                disabled={picking !== null}
                onClick={async () => {
                  setPicking(i);
                  try {
                    await onPick(c);
                  } finally {
                    setPicking(null);
                  }
                }}
                style={{
                  textAlign: "left",
                  background: "white",
                  border: `1px solid ${T.lightBorder}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: picking !== null ? "default" : "pointer",
                  opacity: picking !== null && picking !== i ? 0.5 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: T.lightText }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 2 }}>
                  {formatPhoneDisplay(c.phone)}
                </div>
                {c.address && (
                  <div style={{ fontSize: 11, color: T.lightMuted, marginTop: 2 }}>
                    {c.address}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
