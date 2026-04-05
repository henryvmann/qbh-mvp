"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Not authenticated — show landing
      }
      setChecking(false);
    }
    checkAuth();
  }, [router]);

  if (checking) {
    return <main className="min-h-screen bg-[#1E2228]" />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1E2228] text-[#F0F2F5]">
      {/* Decorative circle */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-white/10"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-20">
        <div
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: "#7BA59A" }}
        >
          QBH &#10022; Your Health Ally
        </div>

        <h1 className="mt-6 text-4xl font-light tracking-tight sm:text-5xl">
          Your healthcare, handled.
        </h1>

        <p className="mt-4 max-w-xl text-lg text-[#8A9BAE]">
          You don&apos;t have to manage this alone. QB keeps track, follows up,
          and handles the details so you don&apos;t have to.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: "#7BA59A", color: "#1E2228" }}
          >
            Get started &rarr;
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-medium text-[#F0F2F5] shadow-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
