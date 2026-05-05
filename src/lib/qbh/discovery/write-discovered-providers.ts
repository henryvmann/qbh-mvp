import { supabaseAdmin } from "../../supabase-server";
import { lookupPlaceDetails } from "../../google/places-lookup";
import { batchNpiLookup } from "../../npi/lookup";
import type {
  DiscoveredProvider,
  PlaidDiscoveryTransaction,
} from "./build-provider-registry";

type WriteDiscoveryParams = {
  userId: string;
  providers: DiscoveredProvider[];
  transactions: PlaidDiscoveryTransaction[];
};

function cleanName(input: string): string {
  return input.trim().toLowerCase();
}

/** Map credential prefixes to specialty labels */
const CREDENTIAL_TO_SPECIALTY: Record<string, string> = {
  "md": "Physician", "do": "Physician", "dds": "Dentist", "dmd": "Dentist",
  "od": "Optometrist", "dc": "Chiropractor", "dpm": "Podiatrist",
  "np": "Nurse Practitioner", "pa": "Physician Assistant", "rn": "Nurse",
  "phd": "Psychologist", "psyd": "Psychologist",
  "lcsw": "Therapist", "lmft": "Therapist", "lpc": "Therapist",
  "fnp-bc": "Nurse Practitioner", "aprn": "Nurse Practitioner",
};

/** Move credential prefixes to after the name and detect specialty */
function stripCredentials(name: string): { cleanedName: string; detectedSpecialty: string | null } {
  const CRED_PREFIXES = /^\s*(M\.?D\.?|D\.?D\.?S\.?|D\.?O\.?|D\.?P\.?M\.?|N\.?P\.?|P\.?A\.?|R\.?N\.?|D\.?C\.?|O\.?D\.?|Ph\.?D\.?|Psy\.?D\.?|D\.?M\.?D\.?|FNP-BC|LCSW|LMFT|LPC|APRN)\s+/i;
  let cleaned = name.trim();
  let specialty: string | null = null;
  const credentials: string[] = [];

  // Extract credentials from the front
  let match = cleaned.match(CRED_PREFIXES);
  while (match) {
    const raw = match[1].replace(/\./g, "").toUpperCase();
    const cred = raw.toLowerCase();
    if (!specialty) specialty = CREDENTIAL_TO_SPECIALTY[cred] || null;
    credentials.push(raw);
    cleaned = cleaned.replace(CRED_PREFIXES, "").trim();
    match = cleaned.match(CRED_PREFIXES);
  }

  // Title case if ALL CAPS
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // Append credentials after name: "Eric Echelman, DDS"
  if (credentials.length > 0) {
    cleaned = `${cleaned}, ${credentials.join(", ")}`;
  }

  return { cleanedName: cleaned || name.trim(), detectedSpecialty: specialty };
}

/**
 * Check if two provider names are likely the same entity.
 * e.g. "Weston Pharmacy" and "Weston Pharmacy Gifts" → true
 */
function isFuzzyDuplicate(existingName: string, newName: string): boolean {
  const a = cleanName(existingName);
  const b = cleanName(newName);
  if (a === b) return true;
  // If shorter name is a prefix of the longer (with word boundary)
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.startsWith(shorter + " ") || longer.startsWith(shorter + "/")) return true;
  // Strip common suffixes and compare
  const strip = (s: string) => s.replace(/\s+(gifts?|shop|store|pharmacy|rx|inc|llc|pc|pllc|pa|md|dds)\s*$/g, "").trim();
  if (strip(a) === strip(b)) return true;
  return false;
}

export async function writeDiscoveredProviders({
  userId,
  providers,
  transactions,
}: WriteDiscoveryParams) {
  const writableProviders = providers.filter(
    (provider) => provider.bucket === "HEALTHCARE" || provider.bucket === "REVIEW_NEEDED"
  );

  const txById = new Map(
    transactions.map((tx) => [tx.transaction_id, tx] as const)
  );

  const { data: existingProviders, error: existingProvidersError } =
    await supabaseAdmin
      .from("providers")
      .select("id, name")
      .eq("app_user_id", userId);

  if (existingProvidersError) {
    console.error("[writeDiscoveredProviders] failed reading providers", {
      userId,
      message: existingProvidersError.message,
      details: existingProvidersError.details,
      hint: existingProvidersError.hint,
      code: existingProvidersError.code,
    });

    throw new Error(existingProvidersError.message);
  }

  const existingByName = new Map(
    (existingProviders || []).map((provider) => [
      cleanName(provider.name),
      provider.id,
    ])
  );

  const seenInsertNames = new Set<string>();

  const filteredForInsert = writableProviders.filter((provider) => {
    const key = cleanName(provider.provider_name);
    if (!key) return false;
    if (existingByName.has(key)) return false;
    for (const existingName of existingByName.keys()) {
      if (isFuzzyDuplicate(existingName, key)) return false;
    }
    for (const seenName of seenInsertNames) {
      if (isFuzzyDuplicate(seenName, key)) return false;
    }
    seenInsertNames.add(key);
    return true;
  });

  // Backfill NPI lookups for healthcare-bucketed providers that
  // didn't get one during classification. The classifier only
  // ran NPI for "person-name AI-said-no" candidates as a verification
  // signal — confirmed-healthcare providers (CVS, Modern Dermatology,
  // etc.) bypassed that path. Run a second batch here for any
  // healthcare bucket without an npi yet, so the providers row gets
  // populated correctly.
  const npiBackfillCandidates = filteredForInsert
    .filter((p) => p.bucket === "HEALTHCARE" && !p.npi)
    .map((p) => ({
      normalized_name: p.normalized_name,
      original_name: p.provider_name,
    }));
  let npiBackfill = new Map<string, { npi: string | null }>();
  if (npiBackfillCandidates.length > 0) {
    try {
      const results = await batchNpiLookup(npiBackfillCandidates);
      for (const [k, v] of results.entries()) {
        if (v.found && v.npi) npiBackfill.set(k, { npi: v.npi });
      }
      console.log(
        `[writeDiscoveredProviders] NPI backfill: ${npiBackfill.size}/${npiBackfillCandidates.length} healthcare providers got NPI numbers`
      );
    } catch (err) {
      console.error("[writeDiscoveredProviders] NPI backfill failed:", err);
    }
  }

  const providersToInsert = filteredForInsert.map((provider) => {
    const { cleanedName, detectedSpecialty } = stripCredentials(provider.provider_name.trim());
    const npi = provider.npi || npiBackfill.get(provider.normalized_name)?.npi || null;
    return {
      app_user_id: userId,
      name: cleanedName,
      specialty: detectedSpecialty || null,
      status: provider.bucket === "HEALTHCARE" ? "active" : "review_needed",
      guessed_portal_brand: null,
      guessed_portal_confidence: null,
      phone_number: provider.phone_number || null,
      provider_type: provider.provider_type || null,
      npi,
      source: "plaid",
    };
  });

  let insertedProviders: Array<{ id: string; name: string }> = [];

  if (providersToInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("providers")
      .insert(providersToInsert)
      .select("id, name");

    if (error) {
      console.error("[writeDiscoveredProviders] failed inserting providers", {
        userId,
        providerCount: providersToInsert.length,
        providerNames: providersToInsert.map((p) => p.name),
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      throw new Error(error.message);
    }

    insertedProviders = data || [];

    // Auto-lookup phone numbers and addresses for providers without them
    for (const p of insertedProviders) {
      const insertedRow = providersToInsert.find(
        (pi) => pi.name.toLowerCase() === p.name.toLowerCase()
      );
      if (!insertedRow?.phone_number) {
        try {
          const placeInfo = await lookupPlaceDetails(p.name);
          const updates: Record<string, string> = {};
          if (placeInfo.phone) updates.phone_number = placeInfo.phone;
          if (placeInfo.address) updates.address = placeInfo.address;
          // Auto-rename if Places found a better name (strategy A)
          if (placeInfo.placeName && placeInfo.placeName !== p.name) {
            const placeLower = placeInfo.placeName.toLowerCase();
            const currentLower = p.name.toLowerCase();
            // Only rename if the names are clearly related (one contains the other)
            if (placeLower.includes(currentLower) || currentLower.includes(placeLower) ||
                placeLower.split(" ").some((w: string) => w.length >= 4 && currentLower.includes(w))) {
              updates.display_name = placeInfo.placeName;
            }
          }
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from("providers").update(updates).eq("id", p.id);
          }
        } catch {
          // Best effort
        }
      }
    }
  }

  const providerIdByName = new Map<string, string>();

  for (const provider of existingProviders || []) {
    providerIdByName.set(cleanName(provider.name), provider.id);
  }

  for (const provider of insertedProviders) {
    providerIdByName.set(cleanName(provider.name), provider.id);
  }

  const rawVisitRows: Array<{
    app_user_id: string;
    provider_id: string;
    source: string;
    visit_date: string;
    amount_cents: number;
    source_transaction_id: string;
  }> = [];

  const seenVisitTransactionIds = new Set<string>();

  for (const provider of writableProviders) {
    const cleanProviderName = cleanName(provider.provider_name);
    const providerId = providerIdByName.get(cleanProviderName);

    if (!providerId) {
      console.warn("[writeDiscoveredProviders] missing providerId for provider", {
        userId,
        provider_name: provider.provider_name,
        normalized_name: provider.normalized_name,
      });
      continue;
    }

    for (const txId of provider.source_transaction_ids) {
      if (seenVisitTransactionIds.has(txId)) continue;

      const tx = txById.get(txId);
      if (!tx?.date) {
        console.warn("[writeDiscoveredProviders] missing tx/date for txId", {
          userId,
          provider_name: provider.provider_name,
          txId,
        });
        continue;
      }

      seenVisitTransactionIds.add(txId);

      rawVisitRows.push({
        app_user_id: userId,
        provider_id: providerId,
        source: "transaction",
        visit_date: tx.date,
        amount_cents: Math.round(Math.abs(Number(tx.amount || 0)) * 100),
        source_transaction_id: tx.transaction_id,
      });
    }
  }

  if (rawVisitRows.length > 0) {
    const sourceTransactionIds = rawVisitRows.map(
      (row) => row.source_transaction_id
    );

    const { data: existingVisits, error: existingVisitsError } =
      await supabaseAdmin
        .from("provider_visits")
        .select("source_transaction_id")
        .eq("app_user_id", userId)
        .in("source_transaction_id", sourceTransactionIds);

    if (existingVisitsError) {
      console.error(
        "[writeDiscoveredProviders] failed reading existing provider_visits",
        {
          userId,
          message: existingVisitsError.message,
          details: existingVisitsError.details,
          hint: existingVisitsError.hint,
          code: existingVisitsError.code,
        }
      );

      throw new Error(existingVisitsError.message);
    }

    const existingSourceIds = new Set(
      (existingVisits || []).map((row) => row.source_transaction_id)
    );

    const visitRows = rawVisitRows.filter(
      (row) => !existingSourceIds.has(row.source_transaction_id)
    );

    if (visitRows.length > 0) {
      const { error: visitInsertError } = await supabaseAdmin
        .from("provider_visits")
        .insert(visitRows);

      if (visitInsertError) {
        console.error(
          "[writeDiscoveredProviders] failed inserting provider_visits",
          {
            userId,
            visitCount: visitRows.length,
            sampleRows: visitRows.slice(0, 5),
            message: visitInsertError.message,
            details: visitInsertError.details,
            hint: visitInsertError.hint,
            code: visitInsertError.code,
          }
        );

        throw new Error(visitInsertError.message);
      }
    }

    return {
      provider_count: insertedProviders.length,
      visit_count: visitRows.length,
    };
  }

  return {
    provider_count: insertedProviders.length,
    visit_count: 0,
  };
}