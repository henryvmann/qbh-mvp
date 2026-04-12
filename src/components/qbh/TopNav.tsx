"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "Home", href: "/dashboard" },
  { label: "Goals", href: "/goals" },
  { label: "Visits", href: "/visits" },
  { label: "Timeline", href: "/timeline" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  }

  return (
    <nav
      className="sticky top-0 z-30 border-b border-[#2A2F35]"
      style={{ background: "#1A1D2E" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        {/* QB Logo */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "#FFFFFF",
              boxShadow:
                "0 1px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,1)",
            }}
          >
            <CheckmarkIcon className="h-5 w-5 text-[#D0D3D8]" />
          </div>
          <span className="text-sm font-semibold text-white/90 hidden sm:inline">
            Quarterback Health
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Hamburger menu (mobile + settings) */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-56 rounded-xl bg-white border border-[#EBEDF0] shadow-xl overflow-hidden">
                {/* Mobile nav links */}
                <div className="sm:hidden border-b border-[#EBEDF0]">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                {/* Settings links */}
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]"
                >
                  Kate Settings
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]"
                >
                  Account
                </Link>
                <Link
                  href="/calendar-connect"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]"
                >
                  Calendar Connections
                </Link>
                <Link
                  href="/medications"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5]"
                >
                  Medications
                </Link>
                <Link
                  href="/analytics"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-[#1A1D2E] hover:bg-[#F0F2F5] border-b border-[#EBEDF0]"
                >
                  Your Progress
                </Link>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="block w-full px-4 py-3 text-left text-sm text-[#C03020] hover:bg-red-50"
                >
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
