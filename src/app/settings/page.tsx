"use client";

/**
 * /settings is being merged into /account. Hard redirect so existing
 * links and bookmarks land on the canonical surface. The unique
 * settings sections (Kate communication style, proactivity, focus
 * areas, calendar flexibility) will be ported into /account in a
 * follow-up — for now the data persists via API and is preserved.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account");
  }, [router]);
  return null;
}
