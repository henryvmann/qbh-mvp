/**
 * Provider-name normalization. Shared between bank-discovery import
 * (write-discovered-providers) and the manual-add API. Credentials
 * that appear before the name ("LCSW Jennifer Mann") are moved after
 * it ("Jennifer Mann, LCSW") and used to detect the specialty.
 *
 * Without this, manually-added providers and NPI-search-imported
 * providers can carry the wrong shape on the dashboard.
 */

const CREDENTIAL_TO_SPECIALTY: Record<string, string> = {
  md: "Physician", do: "Physician", dds: "Dentist", dmd: "Dentist",
  od: "Optometrist", dc: "Chiropractor", dpm: "Podiatrist",
  np: "Nurse Practitioner", pa: "Physician Assistant", rn: "Nurse",
  phd: "Psychologist", psyd: "Psychologist",
  lcsw: "Therapist", lmft: "Therapist", lpc: "Therapist",
  "fnp-bc": "Nurse Practitioner", aprn: "Nurse Practitioner",
};

const CRED_PREFIX_REGEX =
  /^\s*(M\.?D\.?|D\.?D\.?S\.?|D\.?O\.?|D\.?P\.?M\.?|N\.?P\.?|P\.?A\.?|R\.?N\.?|D\.?C\.?|O\.?D\.?|Ph\.?D\.?|Psy\.?D\.?|D\.?M\.?D\.?|FNP-BC|LCSW|LMFT|LPC|APRN)\s+/i;

export type NormalizedName = {
  cleanedName: string;
  detectedSpecialty: string | null;
};

export function normalizeProviderName(name: string): NormalizedName {
  let cleaned = name.trim();
  let specialty: string | null = null;
  const credentials: string[] = [];

  let match = cleaned.match(CRED_PREFIX_REGEX);
  while (match) {
    const raw = match[1].replace(/\./g, "").toUpperCase();
    const key = raw.toLowerCase();
    if (!specialty) specialty = CREDENTIAL_TO_SPECIALTY[key] || null;
    credentials.push(raw);
    cleaned = cleaned.replace(CRED_PREFIX_REGEX, "").trim();
    match = cleaned.match(CRED_PREFIX_REGEX);
  }

  // Also catch credentials trailing with no comma ("Jennifer Mann LCSW")
  // — convert to comma-prefixed form so display is consistent.
  const trailingMatch = cleaned.match(
    /\s+(M\.?D\.?|D\.?D\.?S\.?|D\.?O\.?|D\.?P\.?M\.?|N\.?P\.?|P\.?A\.?|R\.?N\.?|D\.?C\.?|O\.?D\.?|Ph\.?D\.?|Psy\.?D\.?|D\.?M\.?D\.?|FNP-BC|LCSW|LMFT|LPC|APRN)\s*$/i
  );
  if (trailingMatch) {
    const raw = trailingMatch[1].replace(/\./g, "").toUpperCase();
    const key = raw.toLowerCase();
    if (!specialty) specialty = CREDENTIAL_TO_SPECIALTY[key] || null;
    credentials.push(raw);
    cleaned = cleaned.replace(trailingMatch[0], "").trim();
  }

  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // Strip any trailing punctuation (commas/periods/spaces) left behind
  // after credential extraction. Without this, a source name like
  // "Karen J. Leiser, MD" strips to "Karen J. Leiser," and the append
  // below produces "Karen J. Leiser,, MD".
  cleaned = cleaned.replace(/[,\s.]+$/, "");

  if (credentials.length > 0) {
    cleaned = `${cleaned}, ${credentials.join(", ")}`;
  }

  return { cleanedName: cleaned || name.trim(), detectedSpecialty: specialty };
}
