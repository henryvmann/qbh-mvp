"use client";

/**
 * /insights was folded into /goals (see KateInsightsList at the top of
 * the goals page). This route exists only to redirect old links.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InsightsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/goals");
  }, [router]);
  return null;
}
