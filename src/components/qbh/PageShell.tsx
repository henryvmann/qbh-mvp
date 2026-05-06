"use client";

/**
 * PageShell — shared wrapper for authenticated pages.
 *
 * Delegates to BrandShell so every authed surface gets the v5 brand
 * (Quarterback Health wordmark, Inter + Fraunces fonts, cream/navy
 * palette, electric-blue accents, glass surfaces, 5-tab bottom nav).
 *
 * Old API preserved (children/className/showGrid/maxWidth) so the
 * 20+ existing call sites keep working without edits. The legacy
 * sage-green TopNav and greenhouse grid are gone — that's the point.
 */

import BrandShell from "../brand/BrandShell";
import UserAvatar from "./UserAvatar";

type Props = {
  children: React.ReactNode;
  /** Optional className on the inner content wrapper. */
  className?: string;
  /** Kept for back-compat — old greenhouse grid, now a no-op. */
  showGrid?: boolean;
  /** Tailwind max-width class — translated to a px width for BrandShell. */
  maxWidth?: string;
};

const MAX_WIDTH_PX: Record<string, number> = {
  "max-w-md": 448,
  "max-w-lg": 512,
  "max-w-xl": 576,
  "max-w-2xl": 672,
  "max-w-3xl": 720,
  "max-w-4xl": 800,
  "max-w-5xl": 880,
};

export default function PageShell({
  children,
  className = "",
  maxWidth = "max-w-4xl",
}: Props) {
  const contentMaxWidth = MAX_WIDTH_PX[maxWidth] ?? 800;
  return (
    <BrandShell topRight={<UserAvatar />} contentMaxWidth={contentMaxWidth}>
      <div className={className}>{children}</div>
    </BrandShell>
  );
}
