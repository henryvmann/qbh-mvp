"use client";

import Image from "next/image";

export type Pose = "waving" | "thinking" | "pointing" | "celebrating";

/**
 * Kate avatar — uses the Kate portrait image.
 */
export function Character({ pose: _pose }: { pose: Pose }) {
  return (
    <div className="shrink-0">
      <Image
        src="/kate-avatar.png"
        alt="Kate"
        width={44}
        height={44}
        className="rounded-xl object-cover shadow-sm"
        style={{ width: 44, height: 44 }}
        priority
      />
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
