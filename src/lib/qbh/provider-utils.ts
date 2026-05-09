/**
 * Color palette + grouping for provider specialty types.
 *
 * `label` is the per-card pill ("Dentist", "Dermatology"). `groupLabel`
 * is the section header on /providers when cards are grouped — the
 * "Dental Care Team" framing the user asked for.
 *
 * `order` controls which group sections render first. Primary care
 * leads, then mental health, then everyday-care specialties, then
 * the long-tail specialist bucket and pharmacies.
 */
export const SPECIALTY_COLORS: Record<
  string,
  { bg: string; border: string; accent: string; label: string; groupLabel: string; order: number }
> = {
  pcp:         { bg: "#E8F5E8", border: "#C2D9B8", accent: "#3D5A3D", label: "Primary Care",  groupLabel: "Primary Care",        order: 1 },
  pediatric:   { bg: "#E0F5EE", border: "#A8D8C5", accent: "#3A6F60", label: "Pediatrics",    groupLabel: "Pediatric Care",      order: 2 },
  therapist:   { bg: "#F0E8F5", border: "#D0B8E0", accent: "#6A4A8A", label: "Therapist",     groupLabel: "Mental Health Care",  order: 3 },
  obgyn:       { bg: "#FFE8F0", border: "#E8B0C8", accent: "#8A3060", label: "OB/GYN",        groupLabel: "OB/GYN Care",         order: 4 },
  dentist:     { bg: "#E0F0FF", border: "#B0D0E8", accent: "#2A6090", label: "Dentist",       groupLabel: "Dental Care Team",    order: 5 },
  eye:         { bg: "#FFF5E0", border: "#E8D0A0", accent: "#8A6A20", label: "Eye Care",      groupLabel: "Eye Care Team",       order: 6 },
  dermatology: { bg: "#FFF0E8", border: "#E8C8B0", accent: "#8A5030", label: "Dermatology",   groupLabel: "Dermatology Team",    order: 7 },
  specialist:  { bg: "#F0F5FF", border: "#B0C8E8", accent: "#305080", label: "Specialist",    groupLabel: "Specialists",         order: 8 },
  pharmacy:    { bg: "#F5F5F5", border: "#E0E0E0", accent: "#7A7F8A", label: "Pharmacy",      groupLabel: "Pharmacies",          order: 9 },
  default:     { bg: "#F5F8F5", border: "#D0D8D0", accent: "#5C6B5C", label: "Provider",      groupLabel: "Other Providers",     order: 10 },
};

/** Map from user-facing label to internal color key */
const LABEL_MAP: Record<string, keyof typeof SPECIALTY_COLORS> = {
  "primary care": "pcp", "therapist": "therapist", "dentist": "dentist",
  "eye care": "eye", "dermatology": "dermatology", "ob/gyn": "obgyn",
  "specialist": "specialist", "pharmacy": "pharmacy",
  "pediatrics": "pediatric", "pediatric": "pediatric",
};

export function getSpecialtyColor(provider: { name?: string; specialty?: string | null; provider_type?: string | null }) {
  const specialty = (provider.specialty || "").toLowerCase();
  const name = (provider.name || "").toLowerCase();
  const type = (provider.provider_type || "").toLowerCase();

  if (type === "pharmacy") return SPECIALTY_COLORS.pharmacy;

  // Direct lookup against the structured provider_type set by
  // discovery. Catches "dermatology", "cardiology", etc. without
  // depending on name regex.
  const TYPE_TO_KEY: Record<string, keyof typeof SPECIALTY_COLORS> = {
    dentist: "dentist",
    pediatric: "pediatric",
    pediatrics: "pediatric",
    pcp: "pcp",
    primary_care: "pcp",
    doctor: "pcp",
    mental_health: "therapist",
    therapist: "therapist",
    eye: "eye",
    vision: "eye",
    optometry: "eye",
    dermatology: "dermatology",
    obgyn: "obgyn",
    gynecology: "obgyn",
    cardiology: "specialist",
    gastroenterology: "specialist",
    neurology: "specialist",
    endocrinology: "specialist",
    pulmonology: "specialist",
    oncology: "specialist",
    urology: "specialist",
    rheumatology: "specialist",
    orthopedic: "specialist",
    allergy: "specialist",
    ent: "specialist",
    specialist: "specialist",
  };
  if (type && TYPE_TO_KEY[type]) return SPECIALTY_COLORS[TYPE_TO_KEY[type]];

  // Check explicit specialty label (set by user via Provider Type picker)
  const explicitMatch = LABEL_MAP[specialty];
  if (explicitMatch) return SPECIALTY_COLORS[explicitMatch];

  // Keyword fallback for providers without a typed provider_type.
  // \w* on stems so "dermatology" matches "derm", "cardiology"
  // matches "cardio", etc. — the previous \b(derm)\b only matched
  // "derm" as a standalone word.
  const haystack = specialty + " " + name;
  if (/\b(pediatric\w*|peds|child|children)\b/.test(haystack)) return SPECIALTY_COLORS.pediatric;
  if (/\b(therap\w*|psych\w*|counsel\w*|mental|behav\w*|lcsw|lmft|lpc)\b/.test(haystack)) return SPECIALTY_COLORS.therapist;
  if (/\b(dent\w*|dds|dmd|oral|orthodont\w*)\b/.test(haystack)) return SPECIALTY_COLORS.dentist;
  if (/\b(eye|vision|ophthal\w*|optom\w*)\b/.test(haystack)) return SPECIALTY_COLORS.eye;
  if (/\b(derm\w*|skin)\b/.test(haystack)) return SPECIALTY_COLORS.dermatology;
  if (/\b(obgyn|ob\/gyn|gynec\w*|obstet\w*)\b/.test(haystack)) return SPECIALTY_COLORS.obgyn;
  if (/\b(primary|family|internal|general|pcp)\b/.test(haystack)) return SPECIALTY_COLORS.pcp;
  if (/\b(cardio\w*|neuro\w*|gastro\w*|endo\w*|pulmon\w*|oncol\w*|urol\w*|nephro\w*|orthopaedic|orthopedic|chiropract\w*|podiatr\w*|allerg\w*|rheumat\w*|hematol\w*)\b/.test(haystack)) return SPECIALTY_COLORS.specialist;
  return SPECIALTY_COLORS.default;
}
