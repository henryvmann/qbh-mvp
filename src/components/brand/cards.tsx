"use client";

import React from "react";
import { austin } from "./fonts";
import { brandTheme, T, type BrandMode } from "./index";

/**
 * GlassCard — translucent rounded card with backdrop blur, brand
 * border, and the standard brand shadow. Default container for any
 * dashboard surface (provider rows, settings, info tiles, etc.).
 */
export function GlassCard({
  mode = "light",
  children,
  onClick,
  href,
  padding = 16,
  radius = 18,
  style,
}: {
  mode?: BrandMode;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  padding?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  const t = brandTheme(mode);
  const baseStyle: React.CSSProperties = {
    background: t.glassBg,
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
    border: `1px solid ${t.border}`,
    borderRadius: radius,
    padding,
    boxShadow: t.shadow,
    color: t.text,
    boxSizing: "border-box",
    ...style,
  };
  if (href) {
    return (
      <a
        href={href}
        style={{
          ...baseStyle,
          display: "block",
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        {children}
      </button>
    );
  }
  return <div style={baseStyle}>{children}</div>;
}

/**
 * IconTile — small rounded square in electric-blue tint, used to
 * frame line-icon SVGs inside cards/rows.
 */
export function IconTile({
  mode = "light",
  size = 40,
  radius = 12,
  children,
}: {
  mode?: BrandMode;
  size?: number;
  radius?: number;
  children: React.ReactNode;
}) {
  const t = brandTheme(mode);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: t.tileBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

/**
 * SectionLabel — uppercase, letter-spaced eyebrow used above grouped
 * cards (NEXT STEP, THIS WEEK, CARE, etc.).
 */
export function SectionLabel({
  mode = "light",
  children,
  style,
}: {
  mode?: BrandMode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const t = brandTheme(mode);
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: t.muted,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * AustinHeading — Fraunces serif headline. Used for page titles like
 * "Today.", "Your care team.", "Health, organized.".
 */
export function AustinHeading({
  mode = "light",
  children,
  size = 32,
  style,
}: {
  mode?: BrandMode;
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}) {
  const t = brandTheme(mode);
  return (
    <h1
      className={austin.className}
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: -0.5,
        lineHeight: 1.05,
        margin: 0,
        color: t.text,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export { T };
