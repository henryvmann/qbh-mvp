"use client";

export type Pose = "waving" | "thinking" | "pointing" | "celebrating";

/**
 * Botanical-inspired character — abstract silhouette with leaf/organic accents.
 * Colors from the Matisse-inspired palette: sage, teal, soft greens.
 */
export function Character({ pose }: { pose: Pose }) {
  const armColor = "#5B8A7A"; // darker sage for limbs
  const armProps = {
    stroke: armColor,
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    fill: "none",
  };

  function renderArms() {
    switch (pose) {
      case "waving":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L80 50 L85 40" {...armProps} />
          </>
        );
      case "thinking":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L72 58 L62 45" {...armProps} />
          </>
        );
      case "pointing":
        return (
          <>
            <path d="M35 68 L20 85" {...armProps} />
            <path d="M65 68 L90 68" {...armProps} />
          </>
        );
      case "celebrating":
        return (
          <>
            <path d="M35 68 L15 42" {...armProps} />
            <path d="M65 68 L85 42" {...armProps} />
            {/* Leaf-shaped sparkles */}
            <ellipse cx="12" cy="35" rx="3" ry="5" fill="#8BC4A9" transform="rotate(-30 12 35)" />
            <ellipse cx="88" cy="35" rx="3" ry="5" fill="#8BC4A9" transform="rotate(30 88 35)" />
            <ellipse cx="50" cy="15" rx="2.5" ry="4" fill="#7BA59A" />
            <ellipse cx="30" cy="22" rx="2" ry="3.5" fill="#A3D4BE" transform="rotate(-15 30 22)" />
            <ellipse cx="70" cy="22" rx="2" ry="3.5" fill="#A3D4BE" transform="rotate(15 70 22)" />
          </>
        );
    }
  }

  return (
    <svg
      width="100"
      height="140"
      viewBox="0 0 100 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Head */}
      <circle cx="50" cy="32" r="16" fill="#7BA59A" />
      {/* Body */}
      <rect x="32" y="55" width="36" height="50" rx="10" fill="#5B8A7A" />
      {/* Leaf badge on chest */}
      <ellipse cx="50" cy="70" rx="4" ry="6" fill="#A3D4BE" transform="rotate(20 50 70)" />
      {/* Arms */}
      {renderArms()}
      {/* Legs */}
      <path d="M42 105 L38 130" stroke={armColor} strokeWidth={4} strokeLinecap="round" />
      <path d="M58 105 L62 130" stroke={armColor} strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

export function TalkBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      {/* Tail pointing left */}
      <div
        className="absolute left-0 top-5 -translate-x-full hidden sm:block"
        style={{
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "10px solid rgba(92, 107, 92, 0.10)",
        }}
      />
      <div className="rounded-2xl border border-[#EBEDF0] bg-white p-5 shadow-sm">
        <div className="text-base text-[#1A1D2E]">{children}</div>
      </div>
    </div>
  );
}

export function CharacterWithBubble({
  pose,
  children,
}: {
  pose: Pose;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
      <Character pose={pose} />
      <TalkBubble>{children}</TalkBubble>
    </div>
  );
}
