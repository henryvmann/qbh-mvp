"use client";

/**
 * The top-right avatar that links to /account on every authenticated
 * page. Shows the user's first-name initial in a circle — NOT Kate's
 * photo. (Kate's photo lives in chat bubbles and the Kate-page sticker;
 * the top-right slot is the user's identity, like Gmail's profile chip.)
 *
 * Falls back to "?" while the patient_profile fetch is in flight or
 * when no name is set, so the circle never renders empty.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { T } from "../brand";

function deriveInitial(profile: Record<string, unknown> | null, authName?: string | null): string {
  if (!profile && !authName) return "?";
  const candidates = [
    typeof profile?.display_name === "string" ? profile.display_name : "",
    typeof profile?.nickname === "string" ? profile.nickname : "",
    typeof profile?.first_name === "string" ? profile.first_name : "",
    typeof profile?.full_name === "string" ? profile.full_name : "",
    authName ?? "",
  ];
  for (const c of candidates) {
    const trimmed = c.trim();
    if (trimmed) return trimmed.charAt(0).toUpperCase();
  }
  return "?";
}

export default function UserAvatar() {
  const [initial, setInitial] = useState<string>("?");

  useEffect(() => {
    apiFetch("/api/patient-profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile) {
          setInitial(deriveInitial(data.profile, data?.full_name));
        }
      })
      .catch(() => {
        // Best effort — leave the placeholder if the fetch fails.
      });
  }, []);

  return (
    <Link
      href="/account"
      aria-label="Account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 18,
        background: T.electric,
        color: "#fff",
        border: `1.5px solid ${T.lightBorder}`,
        fontSize: 15,
        fontWeight: 700,
        textDecoration: "none",
        letterSpacing: 0.2,
      }}
    >
      {initial}
    </Link>
  );
}
