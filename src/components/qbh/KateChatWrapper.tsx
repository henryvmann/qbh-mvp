"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import KateChatButton from "./KateChatButton";
import { createClient } from "../../lib/supabase/client";

// Pages where Kate should never render even when authed — onboarding
// has its own Kate-led flow, login/auth screens shouldn't have her.
const HIDE_ON = ["/login", "/onboarding", "/start", "/auth"];

/**
 * Renders the floating Kate chat launcher only for authenticated
 * users. Kate is an in-product feature — she needs your providers,
 * calendar, and history to be useful. Showing her to a stranger on
 * the public landing makes her look broken (because she has nothing
 * to talk about) and confuses first-time visitors.
 */
export default function KateChatWrapper() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authed) return null;
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return <KateChatButton />;
}
