/**
 * Versioned identifiers for the legal documents users accept.
 *
 * Why this exists: counsel asked us to record exactly which version of
 * the Privacy Policy and Terms of Use each user accepted at signup so
 * we can demonstrate the user agreed to the specific document in
 * effect at that time. When a document materially changes, bump the
 * version string here, deploy, and trigger the re-acceptance flow —
 * the new version is what gets stamped onto every subsequent consent
 * record.
 *
 * Convention: vN-YYYY-MM-DD, where YYYY-MM-DD is the effective date
 * of the version. Increment N if multiple revisions land on the same
 * day.
 */

export const LEGAL_DOC_VERSIONS = {
  privacy_policy: "v1-2026-05-14",
  terms: "v2-2026-05-20",
} as const;

export type ConsentMethod = "web" | "mobile-web" | "ios" | "android";

export type ConsentRecord = {
  ai_calls: boolean;
  phi_sharing: boolean;
  terms: boolean;
  privacy_policy: boolean;
  privacy_policy_version: string;
  terms_version: string;
  method: ConsentMethod;
  consented_at: string; // ISO 8601
  user_agent?: string | null;
};

/**
 * Build a fully-formed consent record. Use this anywhere we capture
 * acceptance (onboarding today; re-acceptance flow when a doc version
 * bumps in the future) so the shape stays consistent.
 */
export function buildConsentRecord(opts: {
  aiCalls: boolean;
  phiSharing: boolean;
  termsAndPrivacy: boolean;
  method: ConsentMethod;
  userAgent?: string | null;
}): ConsentRecord {
  return {
    ai_calls: opts.aiCalls,
    phi_sharing: opts.phiSharing,
    terms: opts.termsAndPrivacy,
    privacy_policy: opts.termsAndPrivacy,
    privacy_policy_version: LEGAL_DOC_VERSIONS.privacy_policy,
    terms_version: LEGAL_DOC_VERSIONS.terms,
    method: opts.method,
    consented_at: new Date().toISOString(),
    user_agent: opts.userAgent ?? null,
  };
}

/**
 * Detect a coarse acceptance method from the request side. We don't
 * need precision — just enough to distinguish web browser sessions
 * from native mobile (Capacitor) builds. Tighten later if needed.
 */
export function detectConsentMethod(userAgent: string | null | undefined): ConsentMethod {
  const ua = (userAgent || "").toLowerCase();
  if (ua.includes("capacitor") || ua.includes("qbh-ios")) return "ios";
  if (ua.includes("android") && ua.includes("capacitor")) return "android";
  if (ua.includes("android") || ua.includes("iphone") || ua.includes("ipad") || ua.includes("mobile")) {
    return "mobile-web";
  }
  return "web";
}
