"use client";

import { theme } from "./theme";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Whether this card has a subtle glow effect */
  glow?: boolean;
};

/**
 * GlassCard — frosted glass card surface.
 * Use this instead of `bg-white rounded-2xl border shadow-sm`.
 */
export default function GlassCard({ children, className = "", glow, style, ...props }: Props) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-md ${className}`}
      style={{
        background: theme.glass,
        border: `1px solid ${theme.glassBorder}`,
        boxShadow: glow
          ? `0 4px 24px rgba(15,165,165,0.08), ${theme.cardShadow}`
          : theme.cardShadow,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
