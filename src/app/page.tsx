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
    return <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-[#1A1D2E]" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}>
      {/* Decorative circle */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-[#EBEDF0]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-20">
        <div
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: "#5C6B5C" }}
        >
          QBH &#10022; Your Health Ally
        </div>

        <h1 className="mt-6 text-4xl font-light tracking-tight sm:text-5xl">
          Your healthcare, handled.
        </h1>

        <p className="mt-4 max-w-xl text-lg text-[#7A7F8A]">
          You don&apos;t have to manage this alone. QB keeps track, follows up,
          and handles the details so you don&apos;t have to.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)", boxShadow: "0 8px 24px rgba(92,107,92,0.35)" }}
          >
            Get started &rarr;
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-[#EBEDF0] bg-white shadow-sm px-8 py-3.5 text-sm font-medium text-[#1A1D2E]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
