import { supabaseAdmin } from "../supabase-server";

/**
 * Returns the user's "primary" care recipient name — the Self entry
 * from patient_profile.care_recipients if present, otherwise the first
 * recipient on file. Used to auto-assign newly-discovered providers
 * (Plaid, calendar, manual NPI) to the account holder by default
 * instead of leaving them as "no one yet."
 *
 * Returns null if no recipients are on file at all (rare — onboarding
 * seeds at least the account holder).
 */
export async function getPrimaryRecipientName(appUserId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("patient_profile")
      .eq("id", appUserId)
      .maybeSingle();
    const recipients = (data?.patient_profile as { care_recipients?: Array<{ name?: string; relationship?: string }> } | null)?.care_recipients;
    if (!Array.isArray(recipients) || recipients.length === 0) return null;
    const self = recipients.find((r) => r?.relationship === "Self" && typeof r.name === "string" && r.name.trim());
    if (self?.name?.trim()) return self.name.trim();
    const first = recipients.find((r) => typeof r?.name === "string" && r.name.trim());
    return first?.name?.trim() ?? null;
  } catch {
    return null;
  }
}
