/** Color palette for provider specialty types */
export const SPECIALTY_COLORS: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  pcp:        { bg: "#E8F5E8", border: "#C2D9B8", accent: "#3D5A3D", label: "Primary Care" },
  dentist:    { bg: "#E0F0FF", border: "#B0D0E8", accent: "#2A6090", label: "Dentist" },
  therapist:  { bg: "#F0E8F5", border: "#D0B8E0", accent: "#6A4A8A", label: "Therapist" },
  eye:        { bg: "#FFF5E0", border: "#E8D0A0", accent: "#8A6A20", label: "Eye Care" },
  dermatology:{ bg: "#FFF0E8", border: "#E8C8B0", accent: "#8A5030", label: "Dermatology" },
  obgyn:      { bg: "#FFE8F0", border: "#E8B0C8", accent: "#8A3060", label: "OB/GYN" },
  specialist: { bg: "#F0F5FF", border: "#B0C8E8", accent: "#305080", label: "Specialist" },
  pharmacy:   { bg: "#F5F5F5", border: "#E0E0E0", accent: "#7A7F8A", label: "Pharmacy" },
  default:    { bg: "#F5F8F5", border: "#D0D8D0", accent: "#5C6B5C", label: "Provider" },
};

/** Map from user-facing label to internal color key */
const LABEL_MAP: Record<string, keyof typeof SPECIALTY_COLORS> = {
  "primary care": "pcp", "therapist": "therapist", "dentist": "dentist",
  "eye care": "eye", "dermatology": "dermatology", "ob/gyn": "obgyn",
  "specialist": "specialist", "pharmacy": "pharmacy",
};

export function getSpecialtyColor(provider: { name?: string; specialty?: string | null; provider_type?: string | null }) {
  const specialty = (provider.specialty || "").toLowerCase();
  const name = (provider.name || "").toLowerCase();
  const type = (provider.provider_type || "").toLowerCase();

  if (type === "pharmacy") return SPECIALTY_COLORS.pharmacy;

  // Check explicit specialty label first (set by user via Provider Type picker)
  const explicitMatch = LABEL_MAP[specialty];
  if (explicitMatch) return SPECIALTY_COLORS[explicitMatch];

  // Fall back to keyword detection
  if (/\b(therap|psych|counsel|mental|behav)\b/.test(specialty + name)) return SPECIALTY_COLORS.therapist;
  if (/\b(dent|dds|oral|ortho)\b/.test(specialty + name)) return SPECIALTY_COLORS.dentist;
  if (/\b(eye|vision|ophthal|optom)\b/.test(specialty + name)) return SPECIALTY_COLORS.eye;
  if (/\b(derm|skin)\b/.test(specialty + name)) return SPECIALTY_COLORS.dermatology;
  if (/\b(obgyn|ob\/gyn|gynec|obstet)\b/.test(specialty + name)) return SPECIALTY_COLORS.obgyn;
  if (/\b(primary|family|internal|general|pcp)\b/.test(specialty + name)) return SPECIALTY_COLORS.pcp;
  if (/\b(cardio|neuro|ortho|gastro|endo|pulmon|oncol|urol|nephro)\b/.test(specialty)) return SPECIALTY_COLORS.specialist;
  return SPECIALTY_COLORS.default;
}
