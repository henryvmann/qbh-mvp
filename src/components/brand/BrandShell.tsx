"use client";

/**
 * BrandShell — single wrapper for any authed page in the v5 brand
 * language. Sets up Inter as default font, brand background, and
 * (optionally) a sticky top app bar with the wordmark + a 5-tab
 * bottom nav.
 *
 * Usage:
 *   <BrandShell>
 *     <YourPageContent />
 *   </BrandShell>
 *
 * Customize:
 *   <BrandShell mode="dark" topRight={<UserAvatar />} navItems={...}>
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { inter } from "./fonts";
import Wordmark from "./Wordmark";
import {
  HomeIcon,
  TimelineIcon,
  DocumentIcon,
  SparkleIcon,
  PersonIcon,
} from "./icons";
import HamburgerMenu from "../qbh/HamburgerMenu";
import {
  brandTheme,
  T,
  type BrandMode,
  type NavKey,
  type NavItem,
  DEFAULT_NAV,
} from "./index";

const NAV_ICONS: Record<NavKey, React.ComponentType<{ color?: string; size?: number }>> = {
  home: HomeIcon,
  timeline: TimelineIcon,
  documents: DocumentIcon,
  kate: SparkleIcon,
  you: PersonIcon,
};

export default function BrandShell({
  mode = "light",
  children,
  topRight,
  showNav = true,
  navItems = DEFAULT_NAV,
  contentMaxWidth = 720,
}: {
  mode?: BrandMode;
  children: React.ReactNode;
  /** Optional element rendered at the top-right of the app bar (e.g. user avatar). */
  topRight?: React.ReactNode;
  /** Hide the bottom tab bar (e.g. for full-bleed flows). */
  showNav?: boolean;
  /** Override the default nav set. */
  navItems?: NavItem[];
  /** Max width of the centered content column. */
  contentMaxWidth?: number;
}) {
  const t = brandTheme(mode);
  return (
    <main
      className={inter.className}
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.text,
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <TopAppBar mode={mode} topRight={topRight} />
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: contentMaxWidth,
          margin: "0 auto",
          padding: showNav ? "16px 22px 110px" : "16px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
      {showNav && <BottomNav mode={mode} items={navItems} />}
    </main>
  );
}

function TopAppBar({
  mode,
  topRight,
}: {
  mode: BrandMode;
  topRight?: React.ReactNode;
}) {
  const t = brandTheme(mode);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background:
          mode === "light"
            ? "rgba(250,248,244,0.85)"
            : "rgba(6,18,37,0.85)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <HamburgerMenu />
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <Wordmark mode={mode} size={19} />
          </Link>
        </div>
        <div>{topRight}</div>
      </div>
    </header>
  );
}

function BottomNav({
  mode,
  items,
}: {
  mode: BrandMode;
  items: NavItem[];
}) {
  const t = brandTheme(mode);
  const pathname = usePathname() ?? "";
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background:
          mode === "light"
            ? "rgba(255,255,255,0.85)"
            : "rgba(8,26,51,0.85)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderTop: `1px solid ${t.border}`,
        padding: "10px 4px 28px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
        }}
      >
        {items.map((it) => {
          const Icon = NAV_ICONS[it.key];
          // "home" only matches /dashboard exactly; others match prefix.
          const active =
            it.key === "home"
              ? pathname === it.href
              : pathname === it.href || pathname.startsWith(it.href + "/");
          const color = active
            ? T.electric
            : mode === "light"
            ? T.lightMuted
            : T.darkMuted;
          return (
            <Link
              key={it.key}
              href={it.href}
              style={{
                flex: 1,
                textDecoration: "none",
                padding: "6px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                color,
              }}
            >
              <Icon color={color} size={22} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
