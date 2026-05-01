/**
 * Seed data for the discovery-classifier evaluation harness.
 *
 * Three sources combine into a fixture batch:
 *   1. REAL_SEEDS — anonymized merchant strings sampled from real
 *      plaid_transactions in our DB. Person-name segments are replaced
 *      with {{NAME}} placeholders so we can re-randomize per run and
 *      avoid overfitting to specific names like "Elizabeth Seckler".
 *   2. EDGE_CASES — hand-curated tricky examples I expect to trip the
 *      classifier. Includes ambiguous wellness/spa/gym names, person-
 *      name therapists, lab variants, POS-prefixed strings, etc.
 *   3. NAME_POOLS — first/last names + restaurant names + retail
 *      names used to fill {{NAME}}, {{RESTAURANT}}, {{RETAILER}} slots.
 *
 * Each seed declares ground truth: is_healthcare and (when true) the
 * canonical bucket. The eval harness scores classifier output against
 * these labels.
 */

export type ProviderBucket =
  | "doctor"
  | "dentist"
  | "mental_health"
  | "pt"
  | "pharmacy"
  | "lab"
  | "vision"
  | "chiropractic"
  | "specialist"
  | "hospital"
  | "urgent_care"
  | "imaging";

export type SeedTruth = {
  is_healthcare: boolean;
  bucket: ProviderBucket | null;
  /** What the classifier *should* return as provider_type (when is_healthcare=true). */
  expected_provider_type?: string | null;
  /** Free-text notes for human review of failures. */
  note?: string;
};

export type Seed = {
  /** Merchant string, may contain {{NAME}}, {{RESTAURANT}}, {{RETAILER}} placeholders. */
  template: string;
  truth: SeedTruth;
  /** Plaid category[] commonly seen on this merchant. Influences classifier signal. */
  category?: string[];
  /** Typical $ amount range. */
  amount_range?: [number, number];
  /** "recurring" generates 3-12 visits; "occasional" 1-3; "one-off" exactly 1. */
  visit_pattern?: "recurring" | "occasional" | "one-off";
  /** Tag for grouping in failure analysis (e.g. "person-therapist", "pos-prefix"). */
  tag?: string;
};

// ─────────────────────────────────────────────────────────────────
// Name pools — used to fill placeholders so each fixture batch is
// unique and we don't overfit the classifier to specific names.
// ─────────────────────────────────────────────────────────────────

export const FIRST_NAMES = [
  "Abigail", "Adrian", "Alex", "Amelia", "Anthony", "Beatrice", "Benjamin",
  "Caroline", "Charles", "Charlotte", "Daniel", "David", "Elena", "Eli",
  "Emma", "Ethan", "Fiona", "Gabriel", "Grace", "Hannah", "Henry", "Isabel",
  "Jacob", "James", "Jane", "Jason", "Jennifer", "Joel", "Joshua", "Julia",
  "Kate", "Kyle", "Laura", "Liam", "Lucas", "Mark", "Mary", "Matthew",
  "Megan", "Michael", "Nathan", "Nicole", "Olivia", "Peter", "Rachel",
  "Robert", "Samuel", "Sarah", "Sophia", "Thomas", "Vanessa", "William",
];

export const LAST_NAMES = [
  "Abrams", "Anderson", "Bennett", "Brooks", "Cohen", "Davis", "Edwards",
  "Foster", "Garcia", "Hartley", "Hayes", "Hughes", "Iverson", "Jacobs",
  "Kim", "Klein", "Larson", "Levine", "Marsh", "Mitchell", "Navarro",
  "Norton", "O'Brien", "Park", "Patel", "Quinn", "Reyes", "Russo",
  "Saunders", "Singh", "Stone", "Tate", "Underwood", "Vargas", "Walsh",
  "Weber", "Whitman", "Wong", "Xavier", "Young", "Zimmerman", "Brennan",
  "Caldwell", "Doyle", "Ellsworth", "Finley", "Greer", "Hollister",
];

export const RESTAURANT_POOL = [
  "BLUE OWL CAFE", "RED FORK DINER", "MAPLE GRILL", "SILVER PALM BISTRO",
  "GREEN HOUSE EATERY", "STONE OVEN PIZZA", "GOLDEN PHO", "SUSHI YOSHI",
  "FRESHWAVE BURGERS", "OAKLEAF KITCHEN", "TST*HARBORLIGHT", "TST*ROSEWOOD GRILL",
  "DPP*RIVERSTONE BAR", "TST*COCONUT KITCHEN", "TST*ELM STREET TACOS",
];

export const RETAIL_POOL = [
  "TARGET T-2034", "WALMART SUPERCENTER #4218", "AMAZON MKTPL*K3RH4DSI8",
  "AMAZON MKTPL*X81F2NMPS", "BEST BUY #4523", "MACYS *4291", "OLD NAVY 5532",
  "LULULEMON #421", "NORDSTROM RACK", "NIKE.COM",
];

// ─────────────────────────────────────────────────────────────────
// Real samples (anonymized) — pulled from our actual plaid_transactions.
// These reflect the EXACT formats Plaid emits and are critical for
// realistic eval. Ground-truth labels are hand-applied.
// ─────────────────────────────────────────────────────────────────

export const REAL_SEEDS: Seed[] = [
  // ── Healthcare ──
  { template: "WESTON PHARMACY", truth: { is_healthcare: true, bucket: "pharmacy", expected_provider_type: "pharmacy" }, category: ["Healthcare", "Pharmacy"], amount_range: [10, 80], visit_pattern: "recurring", tag: "pharmacy-named" },
  { template: "CVS", truth: { is_healthcare: true, bucket: "pharmacy", expected_provider_type: "pharmacy" }, category: ["Shops", "Pharmacy"], amount_range: [5, 45], visit_pattern: "recurring", tag: "pharmacy-chain" },
  { template: "WALGREENS #4218", truth: { is_healthcare: true, bucket: "pharmacy", expected_provider_type: "pharmacy" }, category: ["Shops", "Pharmacy"], amount_range: [5, 60], visit_pattern: "occasional", tag: "pharmacy-chain" },
  { template: "RITE AID 0327", truth: { is_healthcare: true, bucket: "pharmacy", expected_provider_type: "pharmacy" }, category: ["Shops", "Pharmacy"], amount_range: [5, 50], visit_pattern: "occasional", tag: "pharmacy-chain" },
  { template: "DUANE READE 14102", truth: { is_healthcare: true, bucket: "pharmacy", expected_provider_type: "pharmacy" }, category: ["Shops", "Pharmacy"], amount_range: [5, 40], visit_pattern: "occasional", tag: "pharmacy-chain" },
  { template: "{{FIRST_LAST_UPPER}}", truth: { is_healthcare: true, bucket: "mental_health", expected_provider_type: "mental_health", note: "Therapist person-name pattern" }, amount_range: [150, 350], visit_pattern: "recurring", tag: "person-therapist" },

  // ── Insurance (NOT healthcare — premium payments) ──
  { template: "LEMONADE INSURANCE", truth: { is_healthcare: false, bucket: null, note: "Insurance payment, not provider visit" }, category: ["Service", "Insurance"], amount_range: [40, 200], visit_pattern: "recurring", tag: "insurance" },
  { template: "WILLIAM PENN PREM DEBIT PPD ID: 3131976260", truth: { is_healthcare: false, bucket: null, note: "Insurance ACH debit" }, category: ["Service", "Insurance"], amount_range: [80, 400], visit_pattern: "recurring", tag: "insurance-ach" },
  { template: "GEICO AUTO", truth: { is_healthcare: false, bucket: null }, amount_range: [100, 250], visit_pattern: "recurring", tag: "insurance" },
  { template: "STATE FARM INSURANCE", truth: { is_healthcare: false, bucket: null }, amount_range: [80, 300], visit_pattern: "recurring", tag: "insurance" },

  // ── Food & drink (NOT healthcare) ──
  { template: "TST*{{RESTAURANT}}", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Restaurants"], amount_range: [12, 95], visit_pattern: "occasional", tag: "pos-prefix" },
  { template: "DPP*{{RESTAURANT}}", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Restaurants"], amount_range: [12, 95], visit_pattern: "occasional", tag: "pos-prefix" },
  { template: "STARBUCKS STORE 0{{NUM4}}", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Coffee Shop"], amount_range: [4, 18], visit_pattern: "recurring", tag: "coffee" },
  { template: "TRADER JOE'S #520", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Supermarkets"], amount_range: [30, 180], visit_pattern: "recurring", tag: "grocery" },
  { template: "WHOLE FOODS MARKET 10115", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Supermarkets"], amount_range: [40, 220], visit_pattern: "recurring", tag: "grocery" },
  { template: "VAN LEEUWEN ICE CREAM", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Restaurants"], amount_range: [5, 18], visit_pattern: "occasional", tag: "ice-cream" },
  { template: "DUNKIN' DONUTS #348412", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Coffee Shop"], amount_range: [3, 15], visit_pattern: "recurring", tag: "coffee" },
  { template: "POKEWORKS - WESTPORT CP", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Restaurants"], amount_range: [12, 30], visit_pattern: "occasional", tag: "restaurant" },
  { template: "UBER EATS", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink"], amount_range: [15, 60], visit_pattern: "recurring", tag: "delivery" },
  { template: "SHAKE SHACK", truth: { is_healthcare: false, bucket: null }, category: ["Food and Drink", "Restaurants"], amount_range: [10, 28], visit_pattern: "occasional", tag: "restaurant" },

  // ── Markets / "wellness" confounders ──
  { template: "VILLAGE MARKET", truth: { is_healthcare: false, bucket: null, note: "Grocery, not health market" }, category: ["Shops", "Supermarkets"], amount_range: [15, 100], visit_pattern: "recurring", tag: "market-confounder" },
  { template: "LILYS WESTON MARKET", truth: { is_healthcare: false, bucket: null, note: "Grocery despite 'Lilys' name" }, category: ["Shops", "Supermarkets"], amount_range: [20, 90], visit_pattern: "recurring", tag: "market-confounder" },
  { template: "CANDLEWOOD MARKET", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Supermarkets"], amount_range: [15, 85], visit_pattern: "recurring", tag: "market-confounder" },
  { template: "MERRITT COUNTRY STORE", truth: { is_healthcare: false, bucket: null }, category: ["Shops"], amount_range: [10, 50], visit_pattern: "occasional", tag: "market-confounder" },

  // ── Beauty / personal care (NOT healthcare) ──
  { template: "CAMORO SALON", truth: { is_healthcare: false, bucket: null }, category: ["Personal Care", "Hair"], amount_range: [40, 180], visit_pattern: "recurring", tag: "salon" },
  { template: "SHARKEYS CUTS FOR KIDS -", truth: { is_healthcare: false, bucket: null }, category: ["Personal Care", "Hair"], amount_range: [15, 40], visit_pattern: "recurring", tag: "salon" },

  // ── Transit / auto ──
  { template: "MTA*MNR ETIX TICKET", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Public Transportation"], amount_range: [4, 50], visit_pattern: "recurring", tag: "transit" },
  { template: "MTA*NYCT PAYGO", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Public Transportation"], amount_range: [3, 30], visit_pattern: "recurring", tag: "transit" },
  { template: "EXXONMOBIL  47651226", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Gas Station"], amount_range: [25, 90], visit_pattern: "recurring", tag: "gas" },
  { template: "SHELL OIL 5754", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Gas Station"], amount_range: [25, 85], visit_pattern: "recurring", tag: "gas" },
  { template: "SUNOCO 8002 9913", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Gas Station"], amount_range: [25, 85], visit_pattern: "occasional", tag: "gas" },
  { template: "SPLASH CAR WASH WILTON", truth: { is_healthcare: false, bucket: null }, category: ["Service"], amount_range: [10, 35], visit_pattern: "recurring", tag: "auto" },
  { template: "LAZ PARKING M04301-CALE", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Parking"], amount_range: [5, 35], visit_pattern: "occasional", tag: "parking" },
  { template: "E-Z*PASSNY PAYMENT", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Toll"], amount_range: [10, 80], visit_pattern: "occasional", tag: "transit" },
  { template: "NEW YORK CITY TAXI", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Taxi"], amount_range: [12, 60], visit_pattern: "occasional", tag: "transit" },

  // ── Subscriptions / services / utilities ──
  { template: "APPLE.COM/BILL", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Subscription"], amount_range: [1, 30], visit_pattern: "recurring", tag: "subscription" },
  { template: "SPOTIFY", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Subscription"], amount_range: [10, 18], visit_pattern: "recurring", tag: "subscription" },
  { template: "NETFLIX.COM", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Subscription"], amount_range: [10, 25], visit_pattern: "recurring", tag: "subscription" },
  { template: "GOOGLE YOUTUBE TV", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Subscription"], amount_range: [70, 85], visit_pattern: "recurring", tag: "subscription" },
  { template: "EVERSOURCE WEB_PAY PPD ID: 3020181050", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Utilities"], amount_range: [60, 280], visit_pattern: "recurring", tag: "utilities" },
  { template: "OPTIMUM 7808", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Internet"], amount_range: [80, 180], visit_pattern: "recurring", tag: "utilities" },
  { template: "NOOM INC SUB.NOOM.COM", truth: { is_healthcare: false, bucket: null, note: "Wellness app subscription, not a provider" }, category: ["Service", "Subscription"], amount_range: [40, 220], visit_pattern: "occasional", tag: "wellness-app" },

  // ── Retail (general) ──
  { template: "TARGET T-{{NUM4}}", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Department Stores"], amount_range: [15, 200], visit_pattern: "recurring", tag: "retail" },
  { template: "MICHAELS #1521", truth: { is_healthcare: false, bucket: null }, category: ["Shops"], amount_range: [10, 80], visit_pattern: "occasional", tag: "retail" },
  { template: "ANTHROPOLOGIE", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Clothing"], amount_range: [40, 250], visit_pattern: "occasional", tag: "retail" },
  { template: "COSTCO WHSE #0492", truth: { is_healthcare: false, bucket: null, note: "Even though Costco has a pharmacy, default purchase is grocery" }, category: ["Shops"], amount_range: [40, 400], visit_pattern: "recurring", tag: "retail" },
  { template: "AMAZON MKTPL*{{ALPHANUM10}}", truth: { is_healthcare: false, bucket: null }, category: ["Shops"], amount_range: [10, 200], visit_pattern: "recurring", tag: "retail" },
  { template: "STEW LEONARDS-NORWALK GRO", truth: { is_healthcare: false, bucket: null }, category: ["Shops", "Supermarkets"], amount_range: [25, 250], visit_pattern: "recurring", tag: "grocery" },

  // ── Travel ──
  { template: "JETBLUE 27922{{NUM4}}", truth: { is_healthcare: false, bucket: null }, category: ["Travel", "Airlines"], amount_range: [80, 800], visit_pattern: "occasional", tag: "travel" },
  { template: "CL *CHASE TRAVEL", truth: { is_healthcare: false, bucket: null }, category: ["Travel"], amount_range: [50, 1500], visit_pattern: "occasional", tag: "travel" },

  // ── P2P / banking ──
  { template: "ZELLE PAYMENT TO {{FIRST}} {{NANNY_LABEL}} REC JPM99{{ALPHA8}}", truth: { is_healthcare: false, bucket: null, note: "Zelle to nanny — definitely not a provider" }, amount_range: [200, 1200], visit_pattern: "recurring", tag: "p2p-nanny" },
  { template: "VENMO", truth: { is_healthcare: false, bucket: null }, category: ["Transfer", "Debit"], amount_range: [10, 400], visit_pattern: "recurring", tag: "p2p" },
  { template: "ONLINE TRANSFER FROM CHK ...{{NUM4}} TRANSACTION#: {{NUM10}}", truth: { is_healthcare: false, bucket: null }, category: ["Transfer"], amount_range: [50, 5000], visit_pattern: "recurring", tag: "transfer" },
  { template: "REMOTE ONLINE DEPOSIT # {{NUM2}}", truth: { is_healthcare: false, bucket: null }, category: ["Transfer", "Deposit"], amount_range: [100, 9000], visit_pattern: "recurring", tag: "transfer" },
  { template: "PAYMENT TO CHASE CARD ENDING IN {{NUM4}} 03/30", truth: { is_healthcare: false, bucket: null }, category: ["Transfer"], amount_range: [200, 4000], visit_pattern: "recurring", tag: "transfer" },
  { template: "MONTHLY SERVICE FEE", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Financial"], amount_range: [5, 35], visit_pattern: "recurring", tag: "bank-fee" },
  { template: "LATE FEE", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Financial"], amount_range: [25, 50], visit_pattern: "occasional", tag: "bank-fee" },
  { template: "VOLVO CAR FIN AUTO FINAN {{NUM7}} WEB ID: 0000007041", truth: { is_healthcare: false, bucket: null }, category: ["Service", "Financial"], amount_range: [400, 900], visit_pattern: "recurring", tag: "auto-loan" },
  { template: "BILT CARD HOUSING PPD ID: 1844372402", truth: { is_healthcare: false, bucket: null }, category: ["Payment"], amount_range: [800, 4500], visit_pattern: "recurring", tag: "rent" },

  // ── Recreation / fitness ──
  { template: "SPORTPLEX FIELDHOUSE", truth: { is_healthcare: false, bucket: null }, category: ["Recreation"], amount_range: [15, 80], visit_pattern: "recurring", tag: "recreation" },
  { template: "FSP*ROCK CLIMB FAIRFIELD", truth: { is_healthcare: false, bucket: null }, category: ["Recreation"], amount_range: [15, 60], visit_pattern: "recurring", tag: "recreation" },
  { template: "GALAXY VR", truth: { is_healthcare: false, bucket: null }, category: ["Recreation", "Entertainment"], amount_range: [15, 50], visit_pattern: "occasional", tag: "entertainment" },
  { template: "ACT*WESTPORTRECREATION", truth: { is_healthcare: false, bucket: null }, category: ["Recreation"], amount_range: [20, 200], visit_pattern: "occasional", tag: "recreation" },
];

// ─────────────────────────────────────────────────────────────────
// Hand-curated edge cases — designed to trip the classifier in
// specific ways. Each is intended to surface a bug or judgment call.
// ─────────────────────────────────────────────────────────────────

export const EDGE_CASES: Seed[] = [
  // ── Real healthcare with quirky formats ──
  { template: "SQ *DR {{FIRST_LAST_UPPER}} MD", truth: { is_healthcare: true, bucket: "doctor", expected_provider_type: "doctor" }, amount_range: [100, 500], visit_pattern: "occasional", tag: "square-doctor" },
  { template: "SQ *{{FIRST_LAST_UPPER}} DDS", truth: { is_healthcare: true, bucket: "dentist", expected_provider_type: "dentist" }, amount_range: [80, 600], visit_pattern: "occasional", tag: "square-dentist" },
  { template: "DR. {{LAST_UPPER}} ORTHODONTIC", truth: { is_healthcare: true, bucket: "dentist", expected_provider_type: "dentist" }, amount_range: [200, 1500], visit_pattern: "occasional", tag: "ortho-dentist" },
  { template: "{{FIRST_LAST_UPPER}}, LCSW", truth: { is_healthcare: true, bucket: "mental_health", expected_provider_type: "mental_health" }, amount_range: [120, 250], visit_pattern: "recurring", tag: "credentialed-therapist" },
  { template: "{{FIRST_LAST_UPPER}} LMHC", truth: { is_healthcare: true, bucket: "mental_health", expected_provider_type: "mental_health" }, amount_range: [120, 250], visit_pattern: "recurring", tag: "credentialed-therapist" },
  { template: "{{FIRST_LAST_UPPER}} PSYD", truth: { is_healthcare: true, bucket: "mental_health", expected_provider_type: "mental_health" }, amount_range: [180, 350], visit_pattern: "recurring", tag: "credentialed-therapist" },
  { template: "BOSTON CARDIOLOGY ASSOC", truth: { is_healthcare: true, bucket: "specialist", expected_provider_type: "specialist" }, amount_range: [150, 600], visit_pattern: "occasional", tag: "specialty-clinic" },
  { template: "MOUNT SINAI HEALTH SYSTEM", truth: { is_healthcare: true, bucket: "hospital", expected_provider_type: "hospital" }, amount_range: [50, 2000], visit_pattern: "occasional", tag: "hospital-system" },
  { template: "QUEST DIAGNOSTICS-{{NUM4}}", truth: { is_healthcare: true, bucket: "lab", expected_provider_type: "lab" }, amount_range: [20, 250], visit_pattern: "occasional", tag: "lab" },
  { template: "LABCORP/MEDLAB", truth: { is_healthcare: true, bucket: "lab", expected_provider_type: "lab" }, amount_range: [20, 200], visit_pattern: "occasional", tag: "lab" },
  { template: "CITYMD URGENT CARE - 89TH ST", truth: { is_healthcare: true, bucket: "urgent_care", expected_provider_type: "urgent_care" }, amount_range: [80, 300], visit_pattern: "occasional", tag: "urgent-care" },
  { template: "ONE MEDICAL", truth: { is_healthcare: true, bucket: "doctor", expected_provider_type: "doctor" }, amount_range: [50, 400], visit_pattern: "occasional", tag: "primary-care" },
  { template: "WARBY PARKER", truth: { is_healthcare: true, bucket: "vision", expected_provider_type: "vision", note: "Eyewear retailer with eye exams — debatable, lean healthcare" }, amount_range: [80, 600], visit_pattern: "occasional", tag: "vision-retail" },
  { template: "MODERN DERMATOLOGY", truth: { is_healthcare: true, bucket: "specialist", expected_provider_type: "specialist" }, amount_range: [150, 700], visit_pattern: "occasional", tag: "specialty-clinic" },
  { template: "{{FIRST_LAST_UPPER}} DPT PHYSICAL THERAP", truth: { is_healthcare: true, bucket: "pt", expected_provider_type: "pt" }, amount_range: [80, 250], visit_pattern: "recurring", tag: "physical-therapy" },
  { template: "WESTSIDE ORTHOPEDIC SURGERY", truth: { is_healthcare: true, bucket: "specialist", expected_provider_type: "specialist" }, amount_range: [200, 1500], visit_pattern: "occasional", tag: "specialty-clinic" },
  { template: "PEDIATRIC ASSOCIATES OF NORWALK", truth: { is_healthcare: true, bucket: "doctor", expected_provider_type: "doctor" }, amount_range: [80, 400], visit_pattern: "recurring", tag: "pediatrics" },
  { template: "ALMA THERAPY 8005551234", truth: { is_healthcare: false, bucket: null, note: "Alma is a billing platform; charge appears as Alma but underlying service is therapy. Tricky." }, amount_range: [100, 300], visit_pattern: "recurring", tag: "platform-not-provider" },

  // ── Confounders that LOOK healthcare but aren't ──
  { template: "WELLNESS CENTER OF BOSTON", truth: { is_healthcare: false, bucket: null, note: "Spa/yoga, not provider" }, amount_range: [30, 200], visit_pattern: "occasional", tag: "wellness-confounder" },
  { template: "EQUINOX FITNESS", truth: { is_healthcare: false, bucket: null, note: "Gym" }, amount_range: [180, 350], visit_pattern: "recurring", tag: "gym" },
  { template: "MIND BODY STUDIO", truth: { is_healthcare: false, bucket: null, note: "Yoga studio, not therapy" }, amount_range: [25, 200], visit_pattern: "recurring", tag: "wellness-confounder" },
  { template: "PURE BARRE", truth: { is_healthcare: false, bucket: null, note: "Fitness chain" }, amount_range: [30, 250], visit_pattern: "recurring", tag: "gym" },
  { template: "FAMILY PRACTICE LLC", truth: { is_healthcare: false, bucket: null, note: "Could be a law firm — name is ambiguous, default to NOT healthcare without other signal" }, amount_range: [200, 600], visit_pattern: "occasional", tag: "ambiguous-llc" },
  { template: "PREMIER HEALTH CLUB", truth: { is_healthcare: false, bucket: null, note: "Gym with 'health' in name" }, amount_range: [60, 200], visit_pattern: "recurring", tag: "gym-with-health" },
  { template: "MASSAGE ENVY {{NUM3}}", truth: { is_healthcare: false, bucket: null, note: "Massage chain, not medical" }, amount_range: [50, 150], visit_pattern: "occasional", tag: "wellness-confounder" },
  { template: "EUROPEAN WAX CENTER", truth: { is_healthcare: false, bucket: null, note: "Has 'center' in name; not medical" }, amount_range: [25, 150], visit_pattern: "occasional", tag: "wellness-confounder" },
  { template: "SOULCYCLE WEST 22", truth: { is_healthcare: false, bucket: null }, amount_range: [30, 250], visit_pattern: "recurring", tag: "fitness" },
  { template: "PAW PATROL VETERINARY", truth: { is_healthcare: false, bucket: null, note: "Pet vet — we only track HUMAN healthcare" }, amount_range: [60, 500], visit_pattern: "occasional", tag: "vet" },
  { template: "BANFIELD PET HOSPITAL", truth: { is_healthcare: false, bucket: null, note: "Pet hospital" }, amount_range: [80, 600], visit_pattern: "occasional", tag: "vet" },
  { template: "HEADWAY HEALTH INC", truth: { is_healthcare: false, bucket: null, note: "Therapy billing platform, not the provider itself" }, amount_range: [100, 300], visit_pattern: "recurring", tag: "platform-not-provider" },
  { template: "SIMPLEPRACTICE", truth: { is_healthcare: false, bucket: null, note: "EHR platform charge appearing on patient card — billing platform, not provider" }, amount_range: [50, 300], visit_pattern: "recurring", tag: "platform-not-provider" },
  { template: "ZOCDOC INC", truth: { is_healthcare: false, bucket: null, note: "Booking platform, not provider" }, amount_range: [10, 80], visit_pattern: "occasional", tag: "platform-not-provider" },

  // ── Person-name confounders (NOT therapists) ──
  { template: "ZELLE PAYMENT TO {{FIRST_UPPER}} {{LAST_UPPER}} JPM99{{ALPHA8}}", truth: { is_healthcare: false, bucket: null, note: "Zelle to a person — could be friend, contractor, etc. Should NOT be a provider." }, amount_range: [50, 500], visit_pattern: "occasional", tag: "zelle-person" },
  { template: "{{FIRST_LAST_UPPER}}", truth: { is_healthcare: false, bucket: null, note: "Bare person name with low frequency / non-recurring should NOT be a therapist" }, amount_range: [20, 100], visit_pattern: "one-off", tag: "person-non-therapist" },
];

// Small set of "ambiguous true healthcare" — should classify but with
// MEDIUM confidence, routing to review_needed in the pipeline.
export const AMBIGUOUS_HEALTHCARE: Seed[] = [
  { template: "{{FIRST_LAST_UPPER}}", truth: { is_healthcare: true, bucket: "mental_health", expected_provider_type: "mental_health", note: "Person-name therapist, only 2 visits — should be flagged review_needed" }, amount_range: [180, 300], visit_pattern: "occasional", tag: "person-therapist-uncertain" },
];
