"use client";

export type Pose = "waving" | "thinking" | "pointing" | "celebrating";

export function Character({ pose }: { pose: Pose }) {
  const armProps = {
    stroke: "#1E2B45",
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
            <circle cx="12" cy="35" r="2.5" fill="#D4A843" />
            <circle cx="88" cy="35" r="2.5" fill="#D4A843" />
            <circle cx="50" cy="18" r="2" fill="#D4A843" />
            <circle cx="30" cy="25" r="1.5" fill="#D4A843" />
            <circle cx="70" cy="25" r="1.5" fill="#D4A843" />
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
      <circle cx="50" cy="32" r="16" fill="#1E2B45" />
      <rect x="32" y="55" width="36" height="50" rx="10" fill="#1E2B45" />
      <circle cx="50" cy="70" r="4" fill="#D4A843" />
      {renderArms()}
      <path d="M42 105 L38 130" stroke="#1E2B45" strokeWidth={4} strokeLinecap="round" />
      <path d="M58 105 L62 130" stroke="#1E2B45" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

export function TalkBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      <div
        className="absolute left-0 top-5 -translate-x-full hidden sm:block"
        style={{
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "10px solid #1E2B45",
        }}
      />
      <div className="rounded-2xl border border-[#1E2B45] bg-[#131B2E] p-5">
        <div className="text-base text-[#EFF4FF]">{children}</div>
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
