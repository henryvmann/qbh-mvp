"use client";

export type Pose = "waving" | "thinking" | "pointing" | "celebrating";

/**
 * Kate monogram avatar — neumorphic style matching the dashboard QB logo.
 * Outer rounded square with soft shadow, inner rounded square with "K".
 */
export function Character({ pose: _pose }: { pose: Pose }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{
        background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)",
        boxShadow:
          "0 2px 8px rgba(74,90,74,0.3)",
      }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: "rgba(255,255,255,0.12)" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <text
            x="7"
            y="11"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
            fill="#D8E8F5"
          >
            K
          </text>
        </svg>
      </div>
    </div>
  );
}

export function TalkBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      {/* Tail pointing left */}
      <div
        className="absolute left-0 top-4 -translate-x-full hidden sm:block"
        style={{
          width: 0,
          height: 0,
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderRight: "8px solid #EBEDF0",
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
    <div className="flex items-start gap-3">
      <Character pose={pose} />
      <TalkBubble>{children}</TalkBubble>
    </div>
  );
}
