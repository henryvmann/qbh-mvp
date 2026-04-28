"use client";

import TopNav from "./TopNav";
import { theme, globalCardOverrides } from "./theme";

type Props = {
  children: React.ReactNode;
  /** Additional className on the <main> */
  className?: string;
  /** Whether to show the subtle greenhouse grid overlay */
  showGrid?: boolean;
  /** Max width class — defaults to max-w-4xl */
  maxWidth?: string;
};

/**
 * PageShell — shared wrapper for all authenticated pages.
 * Provides the greenhouse background, grid overlay, TopNav,
 * and global card style overrides.
 */
export default function PageShell({
  children,
  className = "",
  showGrid = true,
  maxWidth = "max-w-4xl",
}: Props) {
  return (
    <main
      className={`greenhouse min-h-screen pb-16 ${className}`}
      style={{ background: theme.bgGradient }}
    >
      {/* Global card overrides */}
      <style>{globalCardOverrides}</style>

      {/* Greenhouse grid overlay */}
      {showGrid && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            opacity: theme.gridOpacity,
            backgroundImage: `linear-gradient(${theme.gridTeal} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridGold} 1px, transparent 1px)`,
            backgroundSize: `${theme.gridSize} ${theme.gridSize}`,
          }}
        />
      )}

      <TopNav />

      <div className={`relative mx-auto ${maxWidth} px-6 pt-8`}>
        {children}
      </div>
    </main>
  );
}
