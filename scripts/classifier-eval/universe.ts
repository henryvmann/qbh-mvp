/**
 * Merchant universe — every category of US consumer spending we can
 * think of, each with realistic merchant patterns, Plaid categories,
 * amount ranges, and visit cadence. Used by the randomized eval to
 * stress the classifier against the long tail.
 *
 * Source-of-truth labels:
 *   - is_healthcare:false — must NEVER bucket as HEALTHCARE.
 *     A REVIEW_NEEDED leak counts as a false positive.
 *   - is_healthcare:true — should bucket as HEALTHCARE (or REVIEW_NEEDED
 *     if Kate would reasonably ask the user to confirm).
 *
 * Each category contains a list of merchant *templates* (raw strings
 * that mimic Plaid's actual format — chain names with store numbers,
 * "TST*" Toast prefixes, "DPP*" DoorDash prefixes, etc.). A subset
 * use {{NAME}} or {{NUM}} placeholders the generator fills in.
 */

import type { Seed } from "./seeds";

// Helper to make adding entries terser
function nh(opts: Partial<Seed> & { template: string }): Seed {
  return {
    template: opts.template,
    truth: { is_healthcare: false, bucket: null, ...(opts.truth ?? {}) },
    category: opts.category,
    amount_range: opts.amount_range,
    visit_pattern: opts.visit_pattern ?? "occasional",
    tag: opts.tag,
  };
}

function hc(opts: Partial<Seed> & { template: string; bucket: NonNullable<Seed["truth"]["bucket"]> }): Seed {
  return {
    template: opts.template,
    truth: {
      is_healthcare: true,
      bucket: opts.bucket,
      expected_provider_type: opts.truth?.expected_provider_type ?? opts.bucket,
      ...(opts.truth ?? {}),
    },
    category: opts.category,
    amount_range: opts.amount_range,
    visit_pattern: opts.visit_pattern ?? "occasional",
    tag: opts.tag ?? opts.bucket,
  };
}

// ─────────────────────────────────────────────────────────────────
// 1. GROCERY / SUPERMARKETS — chains + indie. Often arrive with no
// Plaid category on credit cards (real bug we just fixed).
// ─────────────────────────────────────────────────────────────────

const GROCERY: Seed[] = [
  nh({ template: "TRADER JOE'S", category: ["Shops", "Supermarkets and Groceries"], amount_range: [25, 280], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "WHOLE FOODS MARKET", amount_range: [30, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "WHOLE FOODS WFM #10153", amount_range: [30, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "STOP & SHOP", category: ["Shops", "Supermarkets and Groceries"], amount_range: [40, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "STOP AND SHOP 0531", amount_range: [40, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "WEGMANS", category: ["Shops", "Supermarkets and Groceries"], amount_range: [50, 300], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "PUBLIX SUPER MARKET", amount_range: [25, 200], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "SAFEWAY", amount_range: [30, 220], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "KROGER", amount_range: [25, 220], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "ALDI", amount_range: [15, 120], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "HARRIS TEETER", amount_range: [25, 200], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "FOOD LION", amount_range: [15, 150], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "GIANT EAGLE", amount_range: [25, 200], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "WINCO FOODS", amount_range: [30, 220], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "SPROUTS FARMERS MKT", amount_range: [30, 180], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "MEIJER", amount_range: [40, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "H-E-B", amount_range: [30, 250], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "ACME MARKETS", amount_range: [30, 200], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "SHOPRITE", amount_range: [30, 220], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "FAIRWAY MARKET", amount_range: [40, 250], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "MORTON WILLIAMS", amount_range: [30, 200], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "WESTERN BEEF", amount_range: [40, 250], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "GRISTEDES", amount_range: [40, 200], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "FOODTOWN", amount_range: [25, 150], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "WINN-DIXIE", amount_range: [25, 180], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "GIANT FOOD", amount_range: [30, 200], visit_pattern: "recurring", tag: "grocery" }),
  nh({ template: "SAVE-A-LOT", amount_range: [20, 140], visit_pattern: "occasional", tag: "grocery" }),
  nh({ template: "INSTACART*WHOLE FOODS", amount_range: [60, 350], visit_pattern: "recurring", tag: "grocery-delivery" }),
  nh({ template: "INSTACART*WEGMANS", amount_range: [60, 350], visit_pattern: "recurring", tag: "grocery-delivery" }),
  nh({ template: "{{LASTNAME_UPPER}} MARKET", amount_range: [15, 90], visit_pattern: "occasional", tag: "indie-grocery" }),
  nh({ template: "{{TOWN_UPPER}} FARMERS MARKET", amount_range: [10, 60], visit_pattern: "occasional", tag: "farmers-market" }),
];

// ─────────────────────────────────────────────────────────────────
// 2. BIG-BOX / GENERAL RETAIL
// ─────────────────────────────────────────────────────────────────

const BIG_BOX: Seed[] = [
  nh({ template: "TARGET T-{{NUM4}}", category: ["Shops"], amount_range: [15, 350], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "TARGET.COM *{{ALPHANUM6}}", amount_range: [10, 280], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "WALMART SUPERCENTER #{{NUM4}}", amount_range: [15, 400], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "WALMART.COM AA", amount_range: [15, 300], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "WAL-MART #{{NUM4}}", amount_range: [15, 400], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "COSTCO WHSE #{{NUM4}}", amount_range: [50, 600], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "COSTCO GAS", amount_range: [25, 90], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "SAM'S CLUB #{{NUM4}}", amount_range: [40, 500], visit_pattern: "recurring", tag: "bigbox" }),
  nh({ template: "BJ'S WHOLESALE #{{NUM4}}", amount_range: [40, 500], visit_pattern: "occasional", tag: "bigbox" }),
  nh({ template: "TJ MAXX #{{NUM4}}", amount_range: [20, 200], visit_pattern: "occasional", tag: "discount-retail" }),
  nh({ template: "MARSHALLS #{{NUM4}}", amount_range: [20, 200], visit_pattern: "occasional", tag: "discount-retail" }),
  nh({ template: "ROSS STORES #{{NUM4}}", amount_range: [15, 150], visit_pattern: "occasional", tag: "discount-retail" }),
  nh({ template: "DOLLAR TREE", amount_range: [3, 30], visit_pattern: "occasional", tag: "dollar-store" }),
  nh({ template: "DOLLAR GENERAL", amount_range: [5, 45], visit_pattern: "occasional", tag: "dollar-store" }),
  nh({ template: "FIVE BELOW", amount_range: [5, 50], visit_pattern: "occasional", tag: "dollar-store" }),
  nh({ template: "DICKS SPORTING GOODS", amount_range: [40, 350], visit_pattern: "occasional", tag: "sporting-goods" }),
  nh({ template: "REI #{{NUM3}}", amount_range: [30, 400], visit_pattern: "occasional", tag: "sporting-goods" }),
];

// ─────────────────────────────────────────────────────────────────
// 3. RESTAURANTS / FAST FOOD / COFFEE
// ─────────────────────────────────────────────────────────────────

const FOOD: Seed[] = [
  nh({ template: "STARBUCKS STORE #{{NUM5}}", category: ["Food and Drink", "Coffee Shop"], amount_range: [4, 18], visit_pattern: "recurring", tag: "coffee" }),
  nh({ template: "DUNKIN #{{NUM6}}", amount_range: [3, 14], visit_pattern: "recurring", tag: "coffee" }),
  nh({ template: "BLUE BOTTLE COFFEE", amount_range: [5, 18], visit_pattern: "occasional", tag: "coffee" }),
  nh({ template: "PEET'S COFFEE", amount_range: [4, 14], visit_pattern: "recurring", tag: "coffee" }),
  nh({ template: "MCDONALD'S F{{NUM4}}", amount_range: [5, 25], visit_pattern: "recurring", tag: "fast-food" }),
  nh({ template: "CHIPOTLE {{NUM4}}", amount_range: [10, 30], visit_pattern: "recurring", tag: "fast-food" }),
  nh({ template: "CHICK-FIL-A #{{NUM4}}", amount_range: [8, 28], visit_pattern: "recurring", tag: "fast-food" }),
  nh({ template: "TACO BELL {{NUM4}}", amount_range: [5, 22], visit_pattern: "occasional", tag: "fast-food" }),
  nh({ template: "PANERA BREAD #{{NUM4}}", amount_range: [10, 28], visit_pattern: "occasional", tag: "fast-food" }),
  nh({ template: "SUBWAY {{NUM5}}", amount_range: [6, 20], visit_pattern: "occasional", tag: "fast-food" }),
  nh({ template: "SHAKE SHACK #{{NUM3}}", amount_range: [12, 35], visit_pattern: "occasional", tag: "fast-food" }),
  nh({ template: "FIVE GUYS #{{NUM4}}", amount_range: [12, 35], visit_pattern: "occasional", tag: "fast-food" }),
  nh({ template: "TST*HARBORLIGHT", amount_range: [25, 180], visit_pattern: "occasional", tag: "restaurant-toast" }),
  nh({ template: "TST*ROSEWOOD GRILL", amount_range: [40, 250], visit_pattern: "occasional", tag: "restaurant-toast" }),
  nh({ template: "TST*ELM STREET TACOS", amount_range: [15, 90], visit_pattern: "occasional", tag: "restaurant-toast" }),
  nh({ template: "TST*COCONUT KITCHEN", amount_range: [30, 180], visit_pattern: "occasional", tag: "restaurant-toast" }),
  nh({ template: "TST*{{TOWN_UPPER}} BISTRO", amount_range: [40, 220], visit_pattern: "occasional", tag: "restaurant-toast" }),
  nh({ template: "DPP*RIVERSTONE BAR", amount_range: [30, 200], visit_pattern: "occasional", tag: "restaurant-doorpoint" }),
  nh({ template: "SQ*{{TOWN_UPPER}} CAFE", amount_range: [10, 60], visit_pattern: "occasional", tag: "restaurant-square" }),
  nh({ template: "SQ*BLUE OWL CAFE", amount_range: [12, 50], visit_pattern: "occasional", tag: "restaurant-square" }),
  nh({ template: "DOORDASH*CHIPOTLE", amount_range: [18, 45], visit_pattern: "recurring", tag: "delivery" }),
  nh({ template: "DOORDASH*{{RESTAURANT}}", amount_range: [20, 70], visit_pattern: "recurring", tag: "delivery" }),
  nh({ template: "UBER EATS", amount_range: [15, 65], visit_pattern: "recurring", tag: "delivery" }),
  nh({ template: "UBER EATS HELP.UBER.COM", amount_range: [15, 65], visit_pattern: "recurring", tag: "delivery" }),
  nh({ template: "GRUBHUB*{{RESTAURANT}}", amount_range: [18, 70], visit_pattern: "occasional", tag: "delivery" }),
  nh({ template: "POSTMATES TIP", amount_range: [3, 15], visit_pattern: "occasional", tag: "delivery" }),
  nh({ template: "INSTACART*{{RETAILER}}", amount_range: [40, 220], visit_pattern: "recurring", tag: "delivery" }),
  nh({ template: "DOMINO'S {{NUM4}}", amount_range: [15, 60], visit_pattern: "occasional", tag: "pizza" }),
  nh({ template: "PAPA JOHN'S #{{NUM4}}", amount_range: [15, 50], visit_pattern: "occasional", tag: "pizza" }),
  nh({ template: "{{TOWN_UPPER}} DELI", amount_range: [8, 35], visit_pattern: "occasional", tag: "deli" }),
  nh({ template: "{{TOWN_UPPER}} BAGEL", amount_range: [5, 25], visit_pattern: "occasional", tag: "bagel" }),
  nh({ template: "JERSEY MIKE'S {{NUM4}}", amount_range: [10, 30], visit_pattern: "occasional", tag: "fast-food" }),
];

// ─────────────────────────────────────────────────────────────────
// 4. GAS / FUEL / CHARGING
// ─────────────────────────────────────────────────────────────────

const GAS: Seed[] = [
  nh({ template: "SHELL OIL {{NUM10}}", category: ["Travel", "Gas Stations"], amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "EXXONMOBIL    {{NUM5}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "CHEVRON {{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "BP#{{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "MOBIL {{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "CITGO {{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "SUNOCO {{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "VALERO {{NUM4}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "76 - {{NUM7}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "ARCO {{NUM5}}", amount_range: [25, 80], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "QUIKTRIP {{NUM4}}", amount_range: [10, 70], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "WAWA {{NUM4}}", amount_range: [10, 60], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "SHEETZ {{NUM4}}", amount_range: [10, 60], visit_pattern: "recurring", tag: "gas" }),
  nh({ template: "TESLA SUPERCHARGER", amount_range: [10, 35], visit_pattern: "recurring", tag: "ev-charging" }),
  nh({ template: "EVGO CHARGING", amount_range: [10, 30], visit_pattern: "occasional", tag: "ev-charging" }),
  nh({ template: "CHARGEPOINT INC", amount_range: [5, 25], visit_pattern: "occasional", tag: "ev-charging" }),
];

// ─────────────────────────────────────────────────────────────────
// 5. STREAMING / SUBSCRIPTIONS / SOFTWARE
// ─────────────────────────────────────────────────────────────────

const SUBSCRIPTIONS: Seed[] = [
  nh({ template: "NETFLIX.COM", amount_range: [15, 25], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "HULU", amount_range: [8, 25], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "DISNEY PLUS", amount_range: [8, 18], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "HBO MAX", amount_range: [10, 20], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "PEACOCK PREMIUM", amount_range: [6, 14], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "PARAMOUNT+", amount_range: [6, 14], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "APPLE TV+", amount_range: [7, 12], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "SPOTIFY USA", amount_range: [11, 18], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "APPLE.COM/BILL", amount_range: [1, 50], visit_pattern: "recurring", tag: "subscription" }),
  nh({ template: "NYTimes Digital", amount_range: [4, 25], visit_pattern: "recurring", tag: "news" }),
  nh({ template: "WSJ.COM", amount_range: [15, 40], visit_pattern: "recurring", tag: "news" }),
  nh({ template: "WASHINGTON POST", amount_range: [10, 18], visit_pattern: "recurring", tag: "news" }),
  nh({ template: "ADOBE  *CREATIVE CLOUD", amount_range: [10, 60], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "MICROSOFT*OFFICE 365", amount_range: [7, 15], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "DROPBOX*PLUS", amount_range: [10, 20], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "GOOGLE *ONE", amount_range: [2, 10], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "1PASSWORD", amount_range: [3, 8], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "PATREON*{{LASTNAME_UPPER}}", amount_range: [3, 15], visit_pattern: "recurring", tag: "creator" }),
  nh({ template: "AUDIBLE*MEMBERSHIP", amount_range: [10, 20], visit_pattern: "recurring", tag: "audiobook" }),
];

// ─────────────────────────────────────────────────────────────────
// 6. UTILITIES / INTERNET / PHONE
// ─────────────────────────────────────────────────────────────────

const UTILITIES: Seed[] = [
  nh({ template: "EVERSOURCE ENERGY", amount_range: [80, 350], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "CON EDISON", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "NATIONAL GRID", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "DUKE ENERGY", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "PG&E", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "DOMINION ENERGY", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "SOUTHERN COMPANY", amount_range: [80, 400], visit_pattern: "recurring", tag: "utility-electric" }),
  nh({ template: "VERIZON WIRELESS", amount_range: [60, 250], visit_pattern: "recurring", tag: "phone" }),
  nh({ template: "AT&T*PAYMENT", amount_range: [60, 200], visit_pattern: "recurring", tag: "phone" }),
  nh({ template: "T-MOBILE", amount_range: [40, 200], visit_pattern: "recurring", tag: "phone" }),
  nh({ template: "XFINITY*COMCAST", amount_range: [50, 200], visit_pattern: "recurring", tag: "internet" }),
  nh({ template: "OPTIMUM ALTICE", amount_range: [50, 200], visit_pattern: "recurring", tag: "internet" }),
  nh({ template: "SPECTRUM CHARTER COMM", amount_range: [50, 200], visit_pattern: "recurring", tag: "internet" }),
  nh({ template: "CITY WATER DEPT", amount_range: [30, 150], visit_pattern: "recurring", tag: "utility-water" }),
  nh({ template: "{{TOWN_UPPER}} WATER POLLUTION CTL", amount_range: [40, 200], visit_pattern: "recurring", tag: "utility-water" }),
];

// ─────────────────────────────────────────────────────────────────
// 7. TRAVEL — airlines, hotels, lodging, rideshare
// ─────────────────────────────────────────────────────────────────

const TRAVEL: Seed[] = [
  nh({ template: "DELTA AIR  {{NUM10}}", category: ["Travel", "Airlines and Aviation Services"], amount_range: [120, 1500], visit_pattern: "occasional", tag: "airline" }),
  nh({ template: "UNITED   {{NUM10}}", amount_range: [120, 1500], visit_pattern: "occasional", tag: "airline" }),
  nh({ template: "AMERICAN AIRLINES", amount_range: [120, 1500], visit_pattern: "occasional", tag: "airline" }),
  nh({ template: "SOUTHWES{{NUM10}}", amount_range: [80, 800], visit_pattern: "occasional", tag: "airline" }),
  nh({ template: "JETBLUE   {{NUM10}}", amount_range: [80, 800], visit_pattern: "occasional", tag: "airline" }),
  nh({ template: "MARRIOTT {{TOWN_UPPER}}", amount_range: [150, 800], visit_pattern: "occasional", tag: "hotel" }),
  nh({ template: "HILTON {{TOWN_UPPER}}", amount_range: [150, 800], visit_pattern: "occasional", tag: "hotel" }),
  nh({ template: "HYATT REGENCY {{TOWN_UPPER}}", amount_range: [150, 800], visit_pattern: "occasional", tag: "hotel" }),
  nh({ template: "AIRBNB * HM{{ALPHANUM6}}", amount_range: [100, 1500], visit_pattern: "occasional", tag: "lodging" }),
  nh({ template: "VRBO HM{{ALPHANUM6}}", amount_range: [200, 2000], visit_pattern: "occasional", tag: "lodging" }),
  nh({ template: "UBER   *TRIP", amount_range: [8, 80], visit_pattern: "recurring", tag: "rideshare" }),
  nh({ template: "LYFT   *RIDE WED", amount_range: [8, 80], visit_pattern: "recurring", tag: "rideshare" }),
  nh({ template: "MTA*METROCARD VEN", amount_range: [3, 35], visit_pattern: "recurring", tag: "transit" }),
  nh({ template: "AMTRAK", amount_range: [40, 350], visit_pattern: "occasional", tag: "rail" }),
  nh({ template: "EZ-PASS  REPLENISHMENT", amount_range: [25, 100], visit_pattern: "recurring", tag: "tolls" }),
  nh({ template: "ENTERPRISE RENT-A-CAR", amount_range: [80, 600], visit_pattern: "occasional", tag: "car-rental" }),
  nh({ template: "HERTZ {{TOWN_UPPER}}", amount_range: [80, 600], visit_pattern: "occasional", tag: "car-rental" }),
];

// ─────────────────────────────────────────────────────────────────
// 8. AUTO — service, parts, parking, washes
// ─────────────────────────────────────────────────────────────────

const AUTO: Seed[] = [
  nh({ template: "JIFFY LUBE #{{NUM4}}", amount_range: [50, 200], visit_pattern: "occasional", tag: "auto-service" }),
  nh({ template: "MIDAS {{NUM4}}", amount_range: [80, 500], visit_pattern: "occasional", tag: "auto-service" }),
  nh({ template: "PEP BOYS #{{NUM4}}", amount_range: [60, 400], visit_pattern: "occasional", tag: "auto-service" }),
  nh({ template: "AUTOZONE #{{NUM4}}", amount_range: [15, 150], visit_pattern: "occasional", tag: "auto-parts" }),
  nh({ template: "ADVANCE AUTO PARTS", amount_range: [15, 150], visit_pattern: "occasional", tag: "auto-parts" }),
  nh({ template: "{{TOWN_UPPER}} CAR WASH", amount_range: [10, 30], visit_pattern: "occasional", tag: "car-wash" }),
  nh({ template: "MISTER CAR WASH", amount_range: [10, 35], visit_pattern: "recurring", tag: "car-wash" }),
  nh({ template: "PARKING METER {{TOWN_UPPER}}", amount_range: [2, 30], visit_pattern: "recurring", tag: "parking" }),
  nh({ template: "SP * STREETLINE", amount_range: [3, 25], visit_pattern: "recurring", tag: "parking" }),
  nh({ template: "PARKMOBILE", amount_range: [2, 20], visit_pattern: "recurring", tag: "parking" }),
  nh({ template: "{{TOWN_UPPER}} TIRE & AUTO", amount_range: [80, 700], visit_pattern: "occasional", tag: "auto-service" }),
];

// ─────────────────────────────────────────────────────────────────
// 9. ENTERTAINMENT — movies, concerts, attractions
// ─────────────────────────────────────────────────────────────────

const ENTERTAINMENT: Seed[] = [
  nh({ template: "AMC {{NUM4}}", amount_range: [12, 60], visit_pattern: "occasional", tag: "movie" }),
  nh({ template: "REGAL CINEMAS", amount_range: [12, 60], visit_pattern: "occasional", tag: "movie" }),
  nh({ template: "ALAMO DRAFTHOUSE", amount_range: [15, 80], visit_pattern: "occasional", tag: "movie" }),
  nh({ template: "TICKETMASTER {{ALPHANUM6}}", amount_range: [40, 600], visit_pattern: "occasional", tag: "tickets" }),
  nh({ template: "STUBHUB INC", amount_range: [50, 800], visit_pattern: "occasional", tag: "tickets" }),
  nh({ template: "SEATGEEK", amount_range: [40, 800], visit_pattern: "occasional", tag: "tickets" }),
  nh({ template: "EVENTBRITE *", amount_range: [10, 200], visit_pattern: "occasional", tag: "tickets" }),
  nh({ template: "SIX FLAGS *", amount_range: [40, 250], visit_pattern: "occasional", tag: "amusement" }),
  nh({ template: "DISNEY PARKS", amount_range: [80, 500], visit_pattern: "occasional", tag: "amusement" }),
  nh({ template: "{{TOWN_UPPER}} ZOO", amount_range: [15, 80], visit_pattern: "occasional", tag: "attraction" }),
  nh({ template: "{{TOWN_UPPER}} MUSEUM OF ART", amount_range: [10, 40], visit_pattern: "occasional", tag: "museum" }),
  nh({ template: "DAVE & BUSTERS", amount_range: [20, 150], visit_pattern: "occasional", tag: "arcade" }),
];

// ─────────────────────────────────────────────────────────────────
// 10. PERSONAL CARE / SALON / SPA
// ─────────────────────────────────────────────────────────────────

const PERSONAL_CARE: Seed[] = [
  nh({ template: "GREAT CLIPS", amount_range: [15, 35], visit_pattern: "recurring", tag: "haircut" }),
  nh({ template: "SUPERCUTS", amount_range: [15, 35], visit_pattern: "recurring", tag: "haircut" }),
  nh({ template: "{{TOWN_UPPER}} HAIR SALON", amount_range: [40, 250], visit_pattern: "recurring", tag: "salon" }),
  nh({ template: "{{LASTNAME_UPPER}} SALON & SPA", amount_range: [60, 350], visit_pattern: "recurring", tag: "salon" }),
  nh({ template: "MASSAGE ENVY", amount_range: [60, 200], visit_pattern: "recurring", tag: "massage-spa" }),
  nh({ template: "EUROPEAN WAX CTR", amount_range: [40, 150], visit_pattern: "recurring", tag: "waxing" }),
  nh({ template: "DRYBAR", amount_range: [40, 100], visit_pattern: "occasional", tag: "blowout" }),
  nh({ template: "{{TOWN_UPPER}} NAILS", amount_range: [25, 80], visit_pattern: "recurring", tag: "nails" }),
  nh({ template: "BLUEMERCURY", amount_range: [30, 250], visit_pattern: "occasional", tag: "beauty-retail" }),
  nh({ template: "SEPHORA", amount_range: [25, 250], visit_pattern: "occasional", tag: "beauty-retail" }),
  nh({ template: "ULTA BEAUTY", amount_range: [25, 200], visit_pattern: "occasional", tag: "beauty-retail" }),
];

// ─────────────────────────────────────────────────────────────────
// 11. FITNESS / GYMS / WELLNESS-Y
// ─────────────────────────────────────────────────────────────────

const FITNESS: Seed[] = [
  nh({ template: "EQUINOX *MEMBERSHIP", amount_range: [180, 350], visit_pattern: "recurring", tag: "gym-luxury" }),
  nh({ template: "SOULCYCLE *NYC", amount_range: [25, 50], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "SOULCYCLE INC", amount_range: [25, 200], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "PURE BARRE {{TOWN_UPPER}}", amount_range: [25, 250], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "BARRY'S BOOTCAMP", amount_range: [35, 200], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "ORANGETHEORY FITNESS", amount_range: [30, 200], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "PLANET FITNESS", amount_range: [10, 50], visit_pattern: "recurring", tag: "gym" }),
  nh({ template: "CRUNCH FITNESS", amount_range: [10, 50], visit_pattern: "recurring", tag: "gym" }),
  nh({ template: "LA FITNESS *", amount_range: [25, 60], visit_pattern: "recurring", tag: "gym" }),
  nh({ template: "{{TOWN_UPPER}} HEALTH CLUB", amount_range: [50, 200], visit_pattern: "recurring", tag: "gym-healthy-name" }),
  nh({ template: "{{TOWN_UPPER}} ATHLETIC CLUB", amount_range: [50, 200], visit_pattern: "recurring", tag: "gym" }),
  nh({ template: "PREMIER HEALTH CLUB", amount_range: [80, 250], visit_pattern: "recurring", tag: "gym-healthy-name" }),
  nh({ template: "CROSSFIT {{TOWN_UPPER}}", amount_range: [120, 250], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "CORE POWER YOGA", amount_range: [25, 200], visit_pattern: "recurring", tag: "studio" }),
  nh({ template: "PELOTON INTERACTIVE", amount_range: [13, 45], visit_pattern: "recurring", tag: "fitness-app" }),
  nh({ template: "STRAVA SUBSCRIPTION", amount_range: [5, 80], visit_pattern: "recurring", tag: "fitness-app" }),
];

// ─────────────────────────────────────────────────────────────────
// 12. PET — vet, pet stores, services
// ─────────────────────────────────────────────────────────────────

const PETS: Seed[] = [
  nh({ template: "CHEWY.COM", amount_range: [25, 200], visit_pattern: "recurring", tag: "pet-pharmacy-trap" }),
  nh({ template: "PETCO {{NUM4}}", amount_range: [20, 200], visit_pattern: "recurring", tag: "pet-store" }),
  nh({ template: "PETSMART {{NUM4}}", amount_range: [20, 200], visit_pattern: "recurring", tag: "pet-store" }),
  nh({ template: "BARK BOX", amount_range: [25, 50], visit_pattern: "recurring", tag: "pet-subscription" }),
  nh({ template: "{{TOWN_UPPER}} VETERINARY", amount_range: [80, 600], visit_pattern: "occasional", tag: "vet-trap" }),
  nh({ template: "{{TOWN_UPPER}} ANIMAL HOSPITAL", amount_range: [100, 800], visit_pattern: "occasional", tag: "vet-trap" }),
  nh({ template: "BANFIELD PET HOSPITAL", amount_range: [100, 600], visit_pattern: "occasional", tag: "vet-trap" }),
  nh({ template: "VCA ANIMAL HOSPITAL", amount_range: [100, 700], visit_pattern: "occasional", tag: "vet-trap" }),
  nh({ template: "ROVER.COM*PET CARE", amount_range: [40, 200], visit_pattern: "occasional", tag: "pet-service" }),
  nh({ template: "WAG! WALKERS", amount_range: [20, 80], visit_pattern: "occasional", tag: "pet-service" }),
];

// ─────────────────────────────────────────────────────────────────
// 13. INSURANCE — premium payments (NOT clinical visits)
// ─────────────────────────────────────────────────────────────────

const INSURANCE: Seed[] = [
  nh({ template: "GEICO  *AUTO", amount_range: [80, 300], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "STATE FARM INSUR", amount_range: [100, 400], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "PROGRESSIVE INS", amount_range: [80, 350], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "ALLSTATE INSURANCE", amount_range: [100, 400], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "LIBERTY MUTUAL INS", amount_range: [100, 400], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "USAA P&C INS", amount_range: [80, 300], visit_pattern: "recurring", tag: "insurance-auto" }),
  nh({ template: "CIGNA HEALTH INSURANCE", amount_range: [200, 1500], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "AETNA *PREMIUM", amount_range: [200, 1500], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "BLUE CROSS BLUE SHIELD", amount_range: [200, 1500], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "UNITEDHEALTHCARE PREMIUM", amount_range: [200, 1500], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "HUMANA INC PMT", amount_range: [200, 1200], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "KAISER PERMANENTE PMT", amount_range: [200, 1500], visit_pattern: "recurring", tag: "insurance-medical-trap" }),
  nh({ template: "GUARDIAN LIFE", amount_range: [50, 300], visit_pattern: "recurring", tag: "insurance-life" }),
  nh({ template: "METLIFE GROUP", amount_range: [50, 300], visit_pattern: "recurring", tag: "insurance-life" }),
  nh({ template: "NORTHWESTERN MUTUAL", amount_range: [100, 600], visit_pattern: "recurring", tag: "insurance-life" }),
];

// ─────────────────────────────────────────────────────────────────
// 14. FINANCIAL — banks, brokerages, transfers, fees
// ─────────────────────────────────────────────────────────────────

const FINANCIAL: Seed[] = [
  nh({ template: "ZELLE PAYMENT TO {{FIRSTNAME_UPPER}}", amount_range: [10, 1500], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "ZELLE TRANSFER", amount_range: [10, 1500], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "VENMO PAYMENT", amount_range: [5, 500], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "VENMO CASHOUT", amount_range: [10, 800], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "CASH APP*{{FIRSTNAME_UPPER}}", amount_range: [5, 500], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "PAYPAL *{{ALPHANUM6}}", amount_range: [5, 800], visit_pattern: "recurring", tag: "p2p" }),
  nh({ template: "ATM WITHDRAWAL", amount_range: [20, 500], visit_pattern: "recurring", tag: "atm" }),
  nh({ template: "ATM FEE", amount_range: [2, 8], visit_pattern: "recurring", tag: "fee" }),
  nh({ template: "OVERDRAFT FEE", amount_range: [25, 40], visit_pattern: "occasional", tag: "fee" }),
  nh({ template: "MONTHLY MAINTENANCE FEE", amount_range: [5, 25], visit_pattern: "recurring", tag: "fee" }),
  nh({ template: "INTEREST CHARGE ON PURCHASES", amount_range: [10, 200], visit_pattern: "recurring", tag: "interest" }),
  nh({ template: "LATE FEE", amount_range: [20, 50], visit_pattern: "occasional", tag: "fee" }),
  nh({ template: "FIDELITY INVESTMENTS", amount_range: [50, 5000], visit_pattern: "recurring", tag: "brokerage" }),
  nh({ template: "CHARLES SCHWAB & CO", amount_range: [50, 5000], visit_pattern: "recurring", tag: "brokerage" }),
  nh({ template: "VANGUARD BUY", amount_range: [50, 5000], visit_pattern: "recurring", tag: "brokerage" }),
  nh({ template: "ROBINHOOD GOLD", amount_range: [5, 25], visit_pattern: "recurring", tag: "brokerage-sub" }),
  nh({ template: "COINBASE *INC", amount_range: [25, 1000], visit_pattern: "occasional", tag: "crypto" }),
];

// ─────────────────────────────────────────────────────────────────
// 15. HOUSING — rent, mortgage, HOA, repairs
// ─────────────────────────────────────────────────────────────────

const HOUSING: Seed[] = [
  nh({ template: "BILT REWARDS RENT", amount_range: [1500, 7500], visit_pattern: "recurring", tag: "rent" }),
  nh({ template: "RENT PAYMENT *{{TOWN_UPPER}} APTS", amount_range: [1200, 6000], visit_pattern: "recurring", tag: "rent" }),
  nh({ template: "MORTGAGE PAYMENT WELLS FARGO", amount_range: [1500, 8000], visit_pattern: "recurring", tag: "mortgage" }),
  nh({ template: "CHASE MORTGAGE PMT", amount_range: [1500, 8000], visit_pattern: "recurring", tag: "mortgage" }),
  nh({ template: "{{TOWN_UPPER}} HOA MGMT", amount_range: [200, 800], visit_pattern: "recurring", tag: "hoa" }),
  nh({ template: "WESTPORT HOA QTR FEE", amount_range: [400, 1000], visit_pattern: "recurring", tag: "hoa" }),
  nh({ template: "RIDGEFIELD COMMONS HOA", amount_range: [300, 700], visit_pattern: "recurring", tag: "hoa" }),
  nh({ template: "HOME DEPOT #{{NUM4}}", amount_range: [10, 600], visit_pattern: "occasional", tag: "home-improvement" }),
  nh({ template: "LOWES #{{NUM4}}", amount_range: [10, 600], visit_pattern: "occasional", tag: "home-improvement" }),
  nh({ template: "ACE HARDWARE", amount_range: [5, 200], visit_pattern: "occasional", tag: "home-improvement" }),
  nh({ template: "WAYFAIR.COM", amount_range: [40, 800], visit_pattern: "occasional", tag: "furniture" }),
  nh({ template: "IKEA *{{NUM4}}", amount_range: [40, 800], visit_pattern: "occasional", tag: "furniture" }),
  nh({ template: "{{LASTNAME_UPPER}} PLUMBING", amount_range: [100, 1500], visit_pattern: "occasional", tag: "home-service" }),
  nh({ template: "{{TOWN_UPPER}} LANDSCAPING", amount_range: [80, 600], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "{{TOWN_UPPER}} CLEANING", amount_range: [80, 250], visit_pattern: "recurring", tag: "home-service" }),
];

// ─────────────────────────────────────────────────────────────────
// 16. CHILDCARE / EDUCATION
// ─────────────────────────────────────────────────────────────────

const CHILDCARE_EDU: Seed[] = [
  nh({ template: "BRIGHT HORIZONS", amount_range: [800, 3000], visit_pattern: "recurring", tag: "daycare" }),
  nh({ template: "KINDERCARE LEARNING", amount_range: [600, 2500], visit_pattern: "recurring", tag: "daycare" }),
  nh({ template: "{{TOWN_UPPER}} MONTESSORI", amount_range: [800, 3500], visit_pattern: "recurring", tag: "preschool" }),
  nh({ template: "{{TOWN_UPPER}} CHILDREN'S ACADEMY", amount_range: [600, 2500], visit_pattern: "recurring", tag: "preschool" }),
  nh({ template: "COURSERA *{{ALPHANUM6}}", amount_range: [40, 80], visit_pattern: "recurring", tag: "online-edu" }),
  nh({ template: "UDEMY *{{ALPHANUM6}}", amount_range: [10, 200], visit_pattern: "occasional", tag: "online-edu" }),
  nh({ template: "MASTERCLASS *", amount_range: [12, 200], visit_pattern: "recurring", tag: "online-edu" }),
  nh({ template: "DUOLINGO PLUS", amount_range: [4, 80], visit_pattern: "recurring", tag: "online-edu" }),
  nh({ template: "{{TOWN_UPPER}} PUBLIC SCHOOLS", amount_range: [50, 500], visit_pattern: "occasional", tag: "school-fees" }),
  nh({ template: "PTA *{{TOWN_UPPER}} ELEM", amount_range: [10, 100], visit_pattern: "occasional", tag: "school-fees" }),
];

// ─────────────────────────────────────────────────────────────────
// 17. CLOTHING / SHOES / FASHION
// ─────────────────────────────────────────────────────────────────

const CLOTHING: Seed[] = [
  nh({ template: "OLD NAVY {{NUM4}}", amount_range: [15, 200], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "GAP {{NUM4}}", amount_range: [25, 200], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "BANANA REPUBLIC", amount_range: [40, 350], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "J.CREW {{NUM3}}", amount_range: [40, 400], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "MADEWELL {{NUM3}}", amount_range: [40, 400], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "LULULEMON #{{NUM3}}", amount_range: [60, 400], visit_pattern: "occasional", tag: "athleisure" }),
  nh({ template: "ATHLETA #{{NUM3}}", amount_range: [40, 350], visit_pattern: "occasional", tag: "athleisure" }),
  nh({ template: "NIKE.COM", amount_range: [40, 400], visit_pattern: "occasional", tag: "athletic-apparel" }),
  nh({ template: "ADIDAS US ECOMM", amount_range: [40, 350], visit_pattern: "occasional", tag: "athletic-apparel" }),
  nh({ template: "ZARA USA", amount_range: [25, 250], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "H&M  *{{NUM3}}", amount_range: [15, 200], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "UNIQLO USA", amount_range: [20, 250], visit_pattern: "occasional", tag: "clothing" }),
  nh({ template: "NORDSTROM #{{NUM4}}", amount_range: [40, 700], visit_pattern: "occasional", tag: "department" }),
  nh({ template: "MACY'S #{{NUM3}}", amount_range: [25, 500], visit_pattern: "occasional", tag: "department" }),
  nh({ template: "BLOOMINGDALES", amount_range: [60, 700], visit_pattern: "occasional", tag: "department" }),
  nh({ template: "DR. MARTENS", amount_range: [120, 280], visit_pattern: "one-off", tag: "dr-prefix-trap" }),
  nh({ template: "DSW DESIGNER SHOE", amount_range: [40, 300], visit_pattern: "occasional", tag: "shoes" }),
  nh({ template: "ZAPPOS.COM", amount_range: [40, 400], visit_pattern: "occasional", tag: "shoes" }),
];

// ─────────────────────────────────────────────────────────────────
// 18. ONLINE MARKETPLACES — Amazon, Etsy, eBay
// ─────────────────────────────────────────────────────────────────

const MARKETPLACES: Seed[] = [
  nh({ template: "AMAZON MKTPL*{{ALPHANUM6}}", amount_range: [5, 500], visit_pattern: "recurring", tag: "amazon" }),
  nh({ template: "AMAZON.COM*{{ALPHANUM6}}", amount_range: [5, 500], visit_pattern: "recurring", tag: "amazon" }),
  nh({ template: "Amazon.com PRIME", amount_range: [12, 180], visit_pattern: "recurring", tag: "amazon-prime" }),
  nh({ template: "AMAZON FRESH *{{ALPHANUM6}}", amount_range: [30, 250], visit_pattern: "recurring", tag: "amazon-grocery" }),
  nh({ template: "AMZN MKTP US*{{ALPHANUM6}}", amount_range: [5, 500], visit_pattern: "recurring", tag: "amazon" }),
  nh({ template: "ETSY.COM - {{ALPHANUM6}}", amount_range: [10, 200], visit_pattern: "occasional", tag: "etsy" }),
  nh({ template: "EBAY *{{ALPHANUM6}}", amount_range: [10, 400], visit_pattern: "occasional", tag: "ebay" }),
  nh({ template: "SHEIN.COM", amount_range: [15, 150], visit_pattern: "occasional", tag: "fast-fashion" }),
  nh({ template: "TEMU.COM", amount_range: [10, 150], visit_pattern: "occasional", tag: "fast-fashion" }),
  nh({ template: "POSHMARK *{{LASTNAME_UPPER}}", amount_range: [15, 200], visit_pattern: "occasional", tag: "resale" }),
];

// ─────────────────────────────────────────────────────────────────
// 19. GOVERNMENT / TAXES / FEES
// ─────────────────────────────────────────────────────────────────

const GOVERNMENT: Seed[] = [
  nh({ template: "IRS USATAXPYMT", amount_range: [100, 25000], visit_pattern: "occasional", tag: "tax" }),
  nh({ template: "{{STATE}} DEPT OF REVENUE", amount_range: [50, 5000], visit_pattern: "occasional", tag: "tax" }),
  nh({ template: "{{TOWN_UPPER}} TAX COLLECTOR", amount_range: [100, 5000], visit_pattern: "occasional", tag: "tax" }),
  nh({ template: "DMV LICENSE FEE", amount_range: [25, 200], visit_pattern: "occasional", tag: "dmv" }),
  nh({ template: "{{STATE}} DMV", amount_range: [25, 300], visit_pattern: "occasional", tag: "dmv" }),
  nh({ template: "PARKING TICKET PMT", amount_range: [25, 250], visit_pattern: "occasional", tag: "ticket" }),
  nh({ template: "USPS *{{ALPHANUM6}}", amount_range: [3, 50], visit_pattern: "occasional", tag: "postage" }),
];

// ─────────────────────────────────────────────────────────────────
// 20. CHARITY / DONATIONS
// ─────────────────────────────────────────────────────────────────

const CHARITY: Seed[] = [
  nh({ template: "PAYPAL *AMERICANRED", amount_range: [25, 500], visit_pattern: "occasional", tag: "donation" }),
  nh({ template: "ST {{LASTNAME_UPPER}} CHURCH", amount_range: [10, 500], visit_pattern: "recurring", tag: "donation-religious" }),
  nh({ template: "{{TOWN_UPPER}} TEMPLE", amount_range: [50, 500], visit_pattern: "recurring", tag: "donation-religious" }),
  nh({ template: "DONORS CHOOSE", amount_range: [10, 200], visit_pattern: "occasional", tag: "donation" }),
  nh({ template: "GOFUNDME", amount_range: [10, 500], visit_pattern: "occasional", tag: "donation" }),
  nh({ template: "{{TOWN_UPPER}} PTA DONATION", amount_range: [25, 200], visit_pattern: "occasional", tag: "donation" }),
];

// ─────────────────────────────────────────────────────────────────
// 21. SUPPLEMENTS / HEALTHY-BUT-NOT-CLINICAL — vitamin shops, etc.
// ─────────────────────────────────────────────────────────────────

const WELLNESS_NON_CLINICAL: Seed[] = [
  nh({ template: "VITAMIN SHOPPE #{{NUM3}}", amount_range: [20, 150], visit_pattern: "occasional", tag: "supplements-trap" }),
  nh({ template: "GNC LIVE WELL", amount_range: [25, 150], visit_pattern: "occasional", tag: "supplements-trap" }),
  nh({ template: "DESIGNS FOR HEALTH", amount_range: [30, 200], visit_pattern: "occasional", tag: "supplements-trap" }),
  nh({ template: "RITUAL VITAMINS", amount_range: [25, 80], visit_pattern: "recurring", tag: "supplements-trap" }),
  nh({ template: "CARE/OF VITAMINS", amount_range: [20, 60], visit_pattern: "recurring", tag: "supplements-trap" }),
  nh({ template: "GOOP WELLNESS", amount_range: [40, 250], visit_pattern: "occasional", tag: "wellness-trap" }),
  nh({ template: "MOON JUICE *", amount_range: [25, 120], visit_pattern: "occasional", tag: "wellness-trap" }),
];

// ─────────────────────────────────────────────────────────────────
// 22. "DR." / "DOCTOR" non-medical brand traps
// ─────────────────────────────────────────────────────────────────

const DR_PREFIX_TRAPS: Seed[] = [
  nh({ template: "DR PEPPER VENDING", amount_range: [2, 8], visit_pattern: "occasional", tag: "dr-prefix-trap" }),
  nh({ template: "DR. SQUATCH SOAP", amount_range: [30, 80], visit_pattern: "recurring", tag: "dr-prefix-trap" }),
  nh({ template: "DR MARTENS USA", amount_range: [120, 280], visit_pattern: "one-off", tag: "dr-prefix-trap" }),
  nh({ template: "DR. BRONNER'S", amount_range: [10, 60], visit_pattern: "occasional", tag: "dr-prefix-trap" }),
  nh({ template: "DR. SCHOLL'S", amount_range: [12, 60], visit_pattern: "occasional", tag: "dr-prefix-trap" }),
  nh({ template: "DR. OETKER PIZZA", amount_range: [4, 12], visit_pattern: "occasional", tag: "dr-prefix-trap" }),
];

// ─────────────────────────────────────────────────────────────────
// 23. HEALTHCARE PLATFORMS (NOT providers — billing/booking layers)
// ─────────────────────────────────────────────────────────────────

const HEALTHCARE_PLATFORMS_NON_PROVIDER: Seed[] = [
  nh({ template: "SIMPLEPRACTICE.COM", amount_range: [40, 200], visit_pattern: "recurring", tag: "billing-platform-trap" }),
  nh({ template: "PSYCHOLOGY TODAY", amount_range: [10, 50], visit_pattern: "recurring", tag: "billing-platform-trap" }),
  nh({ template: "ZOCDOC INC", amount_range: [0, 50], visit_pattern: "occasional", tag: "billing-platform-trap" }),
  nh({ template: "HEADWAY HEALTH", amount_range: [50, 300], visit_pattern: "recurring", tag: "billing-platform-trap" }),
  nh({ template: "ALMA THERAPY", amount_range: [80, 350], visit_pattern: "recurring", tag: "billing-platform-trap" }),
  nh({ template: "BETTERHELP", amount_range: [50, 350], visit_pattern: "recurring", tag: "telehealth-trap" }),
  nh({ template: "TALKSPACE", amount_range: [50, 350], visit_pattern: "recurring", tag: "telehealth-trap" }),
];

// ─────────────────────────────────────────────────────────────────
// 24. REAL HEALTHCARE — actual clinical providers (must classify HC)
// ─────────────────────────────────────────────────────────────────

const HEALTHCARE: Seed[] = [
  hc({ template: "CVS/PHARMACY {{NUM5}}", bucket: "pharmacy", category: ["Shops", "Pharmacy"], amount_range: [5, 60], visit_pattern: "recurring", tag: "pharmacy" }),
  hc({ template: "WALGREENS #{{NUM4}}", bucket: "pharmacy", category: ["Shops", "Pharmacy"], amount_range: [5, 60], visit_pattern: "recurring", tag: "pharmacy" }),
  hc({ template: "RITE AID 0{{NUM3}}", bucket: "pharmacy", amount_range: [5, 50], visit_pattern: "occasional", tag: "pharmacy" }),
  hc({ template: "DUANE READE 1{{NUM4}}", bucket: "pharmacy", amount_range: [5, 40], visit_pattern: "occasional", tag: "pharmacy" }),
  hc({ template: "{{TOWN_UPPER}} PHARMACY", bucket: "pharmacy", amount_range: [10, 80], visit_pattern: "recurring", tag: "pharmacy" }),
  hc({ template: "{{LASTNAME_UPPER}} DENTAL", bucket: "dentist", amount_range: [80, 800], visit_pattern: "occasional", tag: "dentist" }),
  hc({ template: "{{TOWN_UPPER}} DENTAL ARTS", bucket: "dentist", amount_range: [80, 1500], visit_pattern: "occasional", tag: "dentist" }),
  hc({ template: "ASPEN DENTAL", bucket: "dentist", amount_range: [80, 800], visit_pattern: "occasional", tag: "dentist" }),
  hc({ template: "{{LASTNAME_UPPER}} OBSTETRICS", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "specialist" }),
  hc({ template: "{{LASTNAME_UPPER}} PEDIATRICS", bucket: "doctor", amount_range: [60, 350], visit_pattern: "recurring", tag: "doctor" }),
  hc({ template: "{{TOWN_UPPER}} PEDIATRIC ASSOC", bucket: "doctor", amount_range: [60, 400], visit_pattern: "recurring", tag: "doctor" }),
  hc({ template: "WILLOWS PEDIATRIC", bucket: "doctor", amount_range: [60, 350], visit_pattern: "recurring", tag: "doctor" }),
  hc({ template: "MODERN DERMATOLOGY", bucket: "specialist", amount_range: [80, 500], visit_pattern: "occasional", tag: "dermatology" }),
  hc({ template: "{{TOWN_UPPER}} DERMATOLOGY", bucket: "specialist", amount_range: [80, 500], visit_pattern: "occasional", tag: "dermatology" }),
  hc({ template: "{{LASTNAME_UPPER}} CARDIOLOGY", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "cardiology" }),
  hc({ template: "{{TOWN_UPPER}} URGENT CARE", bucket: "urgent_care", amount_range: [80, 500], visit_pattern: "occasional", tag: "urgent_care" }),
  hc({ template: "CITYMD URGENT CARE", bucket: "urgent_care", amount_range: [80, 400], visit_pattern: "occasional", tag: "urgent_care" }),
  hc({ template: "QUEST DIAGNOSTICS", bucket: "lab", amount_range: [40, 300], visit_pattern: "occasional", tag: "lab" }),
  hc({ template: "LABCORP", bucket: "lab", amount_range: [40, 300], visit_pattern: "occasional", tag: "lab" }),
  hc({ template: "{{TOWN_UPPER}} HOSPITAL", bucket: "hospital", amount_range: [200, 5000], visit_pattern: "occasional", tag: "hospital" }),
  hc({ template: "MOUNT SINAI HOSP", bucket: "hospital", amount_range: [100, 5000], visit_pattern: "occasional", tag: "hospital" }),
  hc({ template: "NORTHWELL HEALTH", bucket: "hospital", amount_range: [100, 3000], visit_pattern: "occasional", tag: "hospital" }),
  hc({ template: "ONE MEDICAL", bucket: "doctor", amount_range: [60, 400], visit_pattern: "recurring", tag: "doctor" }),
  hc({ template: "{{TOWN_UPPER}} VISION", bucket: "vision", amount_range: [80, 400], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "WARBY PARKER {{NUM3}}", bucket: "vision", amount_range: [80, 400], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "PEARLE VISION", bucket: "vision", amount_range: [80, 400], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "{{TOWN_UPPER}} PHYSICAL THERAPY", bucket: "pt", amount_range: [60, 250], visit_pattern: "recurring", tag: "pt" }),
  hc({ template: "{{LASTNAME_UPPER}} CHIROPRACTIC", bucket: "chiropractic", amount_range: [50, 200], visit_pattern: "recurring", tag: "chiropractic" }),
  hc({ template: "{{LASTNAME_UPPER}} {{LASTNAME_UPPER}} LCSW", bucket: "mental_health", amount_range: [120, 350], visit_pattern: "recurring", tag: "therapist" }),
  hc({ template: "{{LASTNAME_UPPER}} PSYD", bucket: "mental_health", amount_range: [150, 400], visit_pattern: "recurring", tag: "therapist" }),
  hc({ template: "BE WELL MENTAL HEALTH", bucket: "mental_health", amount_range: [120, 250], visit_pattern: "recurring", tag: "mental_health" }),
];

// ─────────────────────────────────────────────────────────────────
// 25. DTC TELEHEALTH / DIRECT-TO-CONSUMER WELLNESS
// Mostly real healthcare (prescriptions, telehealth) but the
// classifier needs to treat them as REVIEW_NEEDED at minimum since
// a user might use Hims for hair-loss meds (clinical) or skincare
// (not). We label them is_healthcare:true since the underlying
// service IS clinical care.
// ─────────────────────────────────────────────────────────────────

const DTC_TELEHEALTH: Seed[] = [
  hc({ template: "HIMS HAIR INC", bucket: "doctor", amount_range: [20, 80], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "HERS HEALTH INC", bucket: "doctor", amount_range: [20, 80], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "RO HIMS", bucket: "doctor", amount_range: [20, 100], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "ROMAN HEALTH PHARMACY", bucket: "pharmacy", amount_range: [20, 200], visit_pattern: "recurring", tag: "dtc-pharmacy" }),
  hc({ template: "CEREBRAL INC", bucket: "mental_health", amount_range: [50, 350], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "BRIGHTSIDE HEALTH", bucket: "mental_health", amount_range: [50, 300], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "DONE GLOBAL", bucket: "mental_health", amount_range: [80, 250], visit_pattern: "recurring", tag: "dtc-telehealth" }),
  hc({ template: "FOLX HEALTH", bucket: "doctor", amount_range: [50, 300], visit_pattern: "recurring", tag: "dtc-telehealth" }),
];

// ─────────────────────────────────────────────────────────────────
// 26. AT-HOME TESTING / LABS
// ─────────────────────────────────────────────────────────────────

const AT_HOME_TESTING: Seed[] = [
  hc({ template: "EVERLYWELL", bucket: "lab", amount_range: [40, 250], visit_pattern: "occasional", tag: "at-home-lab" }),
  hc({ template: "LETSGETCHECKED", bucket: "lab", amount_range: [40, 300], visit_pattern: "occasional", tag: "at-home-lab" }),
  hc({ template: "23ANDME INC", bucket: "lab", amount_range: [99, 199], visit_pattern: "one-off", tag: "at-home-lab" }),
  hc({ template: "ANCESTRY *DNA TEST", bucket: "lab", amount_range: [50, 150], visit_pattern: "one-off", tag: "at-home-lab" }),
  hc({ template: "FUNCTION HEALTH", bucket: "lab", amount_range: [400, 600], visit_pattern: "recurring", tag: "at-home-lab" }),
];

// ─────────────────────────────────────────────────────────────────
// 27. HOME MEDICAL EQUIPMENT
// ─────────────────────────────────────────────────────────────────

const MEDICAL_EQUIPMENT: Seed[] = [
  hc({ template: "APRIA HEALTHCARE", bucket: "specialist", amount_range: [50, 600], visit_pattern: "recurring", tag: "dme" }),
  hc({ template: "LINCARE INC", bucket: "specialist", amount_range: [50, 600], visit_pattern: "recurring", tag: "dme" }),
  hc({ template: "RESMED CORP", bucket: "specialist", amount_range: [80, 1500], visit_pattern: "occasional", tag: "dme" }),
  hc({ template: "MEDLINE INDUSTRIES", bucket: "specialist", amount_range: [40, 400], visit_pattern: "occasional", tag: "dme" }),
];

// ─────────────────────────────────────────────────────────────────
// 28. TAX SOFTWARE / ACCOUNTING / FINANCIAL ADVISORS
// ─────────────────────────────────────────────────────────────────

const TAX_FINANCE: Seed[] = [
  nh({ template: "TURBOTAX *INTUIT", amount_range: [20, 300], visit_pattern: "occasional", tag: "tax-software" }),
  nh({ template: "H&R BLOCK", amount_range: [50, 500], visit_pattern: "occasional", tag: "tax-prep" }),
  nh({ template: "INTUIT *QUICKBOOKS", amount_range: [25, 250], visit_pattern: "recurring", tag: "accounting-software" }),
  nh({ template: "{{LASTNAME_UPPER}} CPA", amount_range: [200, 2000], visit_pattern: "occasional", tag: "accountant" }),
  nh({ template: "WEALTHFRONT ADVISERS", amount_range: [10, 200], visit_pattern: "recurring", tag: "advisor" }),
  nh({ template: "BETTERMENT MGMT FEE", amount_range: [3, 100], visit_pattern: "recurring", tag: "advisor" }),
  nh({ template: "ACORNS *MGMT FEE", amount_range: [3, 50], visit_pattern: "recurring", tag: "advisor" }),
  nh({ template: "M1 FINANCE", amount_range: [3, 50], visit_pattern: "recurring", tag: "advisor" }),
];

// ─────────────────────────────────────────────────────────────────
// 29. MEAL KITS / FOOD SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────

const MEAL_KITS: Seed[] = [
  nh({ template: "HELLOFRESH", amount_range: [60, 250], visit_pattern: "recurring", tag: "meal-kit" }),
  nh({ template: "BLUE APRON", amount_range: [60, 250], visit_pattern: "recurring", tag: "meal-kit" }),
  nh({ template: "DAILY HARVEST", amount_range: [50, 200], visit_pattern: "recurring", tag: "meal-kit" }),
  nh({ template: "FACTOR75", amount_range: [80, 250], visit_pattern: "recurring", tag: "meal-kit" }),
  nh({ template: "ATHLETIC GREENS AG1", amount_range: [60, 100], visit_pattern: "recurring", tag: "supplement-sub" }),
  nh({ template: "GREEN CHEF", amount_range: [60, 250], visit_pattern: "recurring", tag: "meal-kit" }),
];

// ─────────────────────────────────────────────────────────────────
// 30. WEARABLES / HEALTH TECH (ambiguous — hardware not care)
// ─────────────────────────────────────────────────────────────────

const HEALTH_TECH: Seed[] = [
  nh({ template: "WHOOP MEMBERSHIP", amount_range: [10, 350], visit_pattern: "recurring", tag: "wearable" }),
  nh({ template: "OURA *RING", amount_range: [10, 400], visit_pattern: "recurring", tag: "wearable" }),
  nh({ template: "EIGHT SLEEP", amount_range: [20, 3000], visit_pattern: "recurring", tag: "wearable" }),
  nh({ template: "LEVELS HEALTH", amount_range: [50, 200], visit_pattern: "recurring", tag: "wearable-cgm" }),
  nh({ template: "FITBIT *PREMIUM", amount_range: [10, 80], visit_pattern: "recurring", tag: "wearable" }),
  nh({ template: "GARMIN.COM", amount_range: [50, 800], visit_pattern: "occasional", tag: "wearable" }),
];

// ─────────────────────────────────────────────────────────────────
// 31. WEDDING / EVENT / FUNERAL VENDORS
// ─────────────────────────────────────────────────────────────────

const EVENT_VENDORS: Seed[] = [
  nh({ template: "{{TOWN_UPPER}} FLORIST", amount_range: [80, 500], visit_pattern: "occasional", tag: "event-vendor" }),
  nh({ template: "{{LASTNAME_UPPER}} PHOTOGRAPHY", amount_range: [200, 5000], visit_pattern: "one-off", tag: "event-vendor" }),
  nh({ template: "THE KNOT WEDDINGS", amount_range: [40, 1000], visit_pattern: "occasional", tag: "event-vendor" }),
  nh({ template: "{{TOWN_UPPER}} CATERING", amount_range: [200, 5000], visit_pattern: "one-off", tag: "event-vendor" }),
  nh({ template: "{{LASTNAME_UPPER}} FUNERAL HOME", amount_range: [500, 12000], visit_pattern: "one-off", tag: "funeral" }),
];

// ─────────────────────────────────────────────────────────────────
// 32. LEGAL / PROFESSIONAL SERVICES
// ─────────────────────────────────────────────────────────────────

const LEGAL: Seed[] = [
  nh({ template: "{{LASTNAME_UPPER}} LAW FIRM", amount_range: [200, 5000], visit_pattern: "occasional", tag: "legal" }),
  nh({ template: "LEGALZOOM.COM", amount_range: [50, 500], visit_pattern: "occasional", tag: "legal" }),
  nh({ template: "ROCKET LAWYER", amount_range: [10, 100], visit_pattern: "recurring", tag: "legal" }),
];

// ─────────────────────────────────────────────────────────────────
// 33. CANNABIS / DISPENSARIES
// ─────────────────────────────────────────────────────────────────

const CANNABIS: Seed[] = [
  nh({ template: "{{TOWN_UPPER}} DISPENSARY", amount_range: [40, 250], visit_pattern: "recurring", tag: "cannabis" }),
  nh({ template: "CURALEAF", amount_range: [40, 200], visit_pattern: "recurring", tag: "cannabis" }),
  nh({ template: "TRULIEVE", amount_range: [40, 200], visit_pattern: "recurring", tag: "cannabis" }),
];

// ─────────────────────────────────────────────────────────────────
// 34. NIGHTLIFE / BARS / VENUES
// ─────────────────────────────────────────────────────────────────

const NIGHTLIFE: Seed[] = [
  nh({ template: "{{TOWN_UPPER}} TAVERN", amount_range: [25, 200], visit_pattern: "occasional", tag: "bar" }),
  nh({ template: "{{LASTNAME_UPPER}}'S PUB", amount_range: [20, 150], visit_pattern: "occasional", tag: "bar" }),
  nh({ template: "{{TOWN_UPPER}} BREWERY", amount_range: [20, 100], visit_pattern: "occasional", tag: "bar" }),
  nh({ template: "TST*{{TOWN_UPPER}} TAP HOUSE", amount_range: [20, 150], visit_pattern: "occasional", tag: "bar" }),
];

// ─────────────────────────────────────────────────────────────────
// 35. TUTORING / EXTRACURRICULAR EDUCATION
// ─────────────────────────────────────────────────────────────────

const TUTORING: Seed[] = [
  nh({ template: "OUTSCHOOL", amount_range: [20, 200], visit_pattern: "occasional", tag: "tutoring" }),
  nh({ template: "VARSITY TUTORS", amount_range: [50, 1000], visit_pattern: "recurring", tag: "tutoring" }),
  nh({ template: "WYZANT TUTORING", amount_range: [40, 200], visit_pattern: "occasional", tag: "tutoring" }),
  nh({ template: "TAKELESSONS *", amount_range: [25, 200], visit_pattern: "recurring", tag: "tutoring" }),
  nh({ template: "MATHNASIUM", amount_range: [200, 500], visit_pattern: "recurring", tag: "tutoring" }),
  nh({ template: "KUMON {{TOWN_UPPER}}", amount_range: [150, 350], visit_pattern: "recurring", tag: "tutoring" }),
];

// ─────────────────────────────────────────────────────────────────
// 36. HOME SERVICES (extended)
// ─────────────────────────────────────────────────────────────────

const HOME_SERVICES: Seed[] = [
  nh({ template: "ANGI *HOME SERVICE", amount_range: [50, 500], visit_pattern: "occasional", tag: "home-service" }),
  nh({ template: "TASKRABBIT *", amount_range: [40, 300], visit_pattern: "occasional", tag: "home-service" }),
  nh({ template: "{{TOWN_UPPER}} PEST CONTROL", amount_range: [80, 400], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "{{LASTNAME_UPPER}} ELECTRIC", amount_range: [100, 1500], visit_pattern: "occasional", tag: "home-service" }),
  nh({ template: "{{TOWN_UPPER}} POOL SERVICE", amount_range: [80, 500], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "TERMINIX", amount_range: [80, 350], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "ORKIN", amount_range: [80, 350], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "MOLLY MAID", amount_range: [120, 350], visit_pattern: "recurring", tag: "home-service" }),
  nh({ template: "MERRY MAIDS", amount_range: [120, 350], visit_pattern: "recurring", tag: "home-service" }),
];

// ─────────────────────────────────────────────────────────────────
// 37. KIDS' ACTIVITIES (sports, music, camps)
// ─────────────────────────────────────────────────────────────────

const KIDS_ACTIVITIES: Seed[] = [
  nh({ template: "{{TOWN_UPPER}} SOCCER CLUB", amount_range: [100, 600], visit_pattern: "recurring", tag: "kids-sports" }),
  nh({ template: "LITTLE LEAGUE *", amount_range: [50, 250], visit_pattern: "recurring", tag: "kids-sports" }),
  nh({ template: "GYMBOREE PLAY", amount_range: [40, 200], visit_pattern: "recurring", tag: "kids-activity" }),
  nh({ template: "THE LITTLE GYM", amount_range: [80, 300], visit_pattern: "recurring", tag: "kids-activity" }),
  nh({ template: "SCHOOL OF ROCK", amount_range: [200, 400], visit_pattern: "recurring", tag: "kids-music" }),
  nh({ template: "GOLDFISH SWIM SCHOOL", amount_range: [80, 250], visit_pattern: "recurring", tag: "kids-sports" }),
  nh({ template: "KIDDIE ACADEMY", amount_range: [600, 2500], visit_pattern: "recurring", tag: "preschool" }),
  nh({ template: "{{TOWN_UPPER}} DAY CAMP", amount_range: [200, 2500], visit_pattern: "occasional", tag: "summer-camp" }),
];

// ─────────────────────────────────────────────────────────────────
// 38. EXPANDED VISION / OPTICAL
// ─────────────────────────────────────────────────────────────────

const VISION_RETAIL: Seed[] = [
  hc({ template: "LENSCRAFTERS #{{NUM3}}", bucket: "vision", amount_range: [80, 600], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "VISIONWORKS", bucket: "vision", amount_range: [80, 500], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "EYEBUYDIRECT", bucket: "vision", amount_range: [40, 300], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "GLASSESUSA.COM", bucket: "vision", amount_range: [40, 300], visit_pattern: "occasional", tag: "vision" }),
  hc({ template: "1-800 CONTACTS", bucket: "vision", amount_range: [50, 350], visit_pattern: "recurring", tag: "vision" }),
  hc({ template: "FOR EYES *", bucket: "vision", amount_range: [80, 500], visit_pattern: "occasional", tag: "vision" }),
];

// ─────────────────────────────────────────────────────────────────
// 39. HEARING AIDS / AUDIOLOGY
// ─────────────────────────────────────────────────────────────────

const HEARING: Seed[] = [
  hc({ template: "MIRACLE-EAR", bucket: "specialist", amount_range: [200, 5000], visit_pattern: "occasional", tag: "audiology" }),
  hc({ template: "BELTONE", bucket: "specialist", amount_range: [200, 5000], visit_pattern: "occasional", tag: "audiology" }),
];

// ─────────────────────────────────────────────────────────────────
// 40. EXPANDED SPECIALTY MEDICAL
// ─────────────────────────────────────────────────────────────────

const SPECIALTY_EXPANDED: Seed[] = [
  hc({ template: "{{LASTNAME_UPPER}} ORTHOPEDIC", bucket: "specialist", amount_range: [80, 800], visit_pattern: "occasional", tag: "ortho" }),
  hc({ template: "{{TOWN_UPPER}} ORTHO ASSOC", bucket: "specialist", amount_range: [80, 800], visit_pattern: "occasional", tag: "ortho" }),
  hc({ template: "{{LASTNAME_UPPER}} GASTRO ASSOC", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "gastro" }),
  hc({ template: "{{LASTNAME_UPPER}} ENDOCRINOLOGY", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "endo" }),
  hc({ template: "{{LASTNAME_UPPER}} UROLOGY", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "urology" }),
  hc({ template: "{{TOWN_UPPER}} ALLERGY ASSOC", bucket: "specialist", amount_range: [80, 500], visit_pattern: "recurring", tag: "allergy" }),
  hc({ template: "{{LASTNAME_UPPER}} ENT", bucket: "specialist", amount_range: [80, 500], visit_pattern: "occasional", tag: "ent" }),
  hc({ template: "{{TOWN_UPPER}} IMAGING CTR", bucket: "imaging", amount_range: [80, 1500], visit_pattern: "occasional", tag: "imaging" }),
  hc({ template: "{{TOWN_UPPER}} RADIOLOGY", bucket: "imaging", amount_range: [80, 1500], visit_pattern: "occasional", tag: "imaging" }),
  hc({ template: "{{TOWN_UPPER}} OB GYN", bucket: "specialist", amount_range: [80, 600], visit_pattern: "occasional", tag: "obgyn" }),
  hc({ template: "{{LASTNAME_UPPER}} PSYCHIATRY", bucket: "mental_health", amount_range: [150, 500], visit_pattern: "recurring", tag: "psychiatry" }),
  hc({ template: "{{TOWN_UPPER}} ACUPUNCTURE", bucket: "specialist", amount_range: [60, 200], visit_pattern: "recurring", tag: "acupuncture" }),
];

// ─────────────────────────────────────────────────────────────────
// 41. STREAMING / GAMING / DIGITAL EXPANDED
// ─────────────────────────────────────────────────────────────────

const DIGITAL: Seed[] = [
  nh({ template: "TWITCH INTERACTIVE", amount_range: [5, 100], visit_pattern: "recurring", tag: "streaming" }),
  nh({ template: "DISCORD NITRO", amount_range: [5, 12], visit_pattern: "recurring", tag: "subscription" }),
  nh({ template: "STEAM PURCHASE", amount_range: [5, 80], visit_pattern: "occasional", tag: "gaming" }),
  nh({ template: "PLAYSTATION NETWORK", amount_range: [5, 80], visit_pattern: "occasional", tag: "gaming" }),
  nh({ template: "XBOX *LIVE", amount_range: [5, 80], visit_pattern: "recurring", tag: "gaming" }),
  nh({ template: "NINTENDO *ESHOP", amount_range: [5, 80], visit_pattern: "occasional", tag: "gaming" }),
  nh({ template: "OPENAI *CHATGPT", amount_range: [10, 250], visit_pattern: "recurring", tag: "ai-sub" }),
  nh({ template: "ANTHROPIC *CLAUDE", amount_range: [10, 250], visit_pattern: "recurring", tag: "ai-sub" }),
  nh({ template: "NOTION LABS", amount_range: [5, 25], visit_pattern: "recurring", tag: "software" }),
  nh({ template: "SLACK TECHNOLOGIES", amount_range: [5, 80], visit_pattern: "recurring", tag: "software" }),
];

// ─────────────────────────────────────────────────────────────────
// Combined export — flat list with tags so the harness can roll up
// per-category accuracy.
// ─────────────────────────────────────────────────────────────────

export const UNIVERSE: Seed[] = [
  ...GROCERY,
  ...BIG_BOX,
  ...FOOD,
  ...GAS,
  ...SUBSCRIPTIONS,
  ...UTILITIES,
  ...TRAVEL,
  ...AUTO,
  ...ENTERTAINMENT,
  ...PERSONAL_CARE,
  ...FITNESS,
  ...PETS,
  ...INSURANCE,
  ...FINANCIAL,
  ...HOUSING,
  ...CHILDCARE_EDU,
  ...CLOTHING,
  ...MARKETPLACES,
  ...GOVERNMENT,
  ...CHARITY,
  ...WELLNESS_NON_CLINICAL,
  ...DR_PREFIX_TRAPS,
  ...HEALTHCARE_PLATFORMS_NON_PROVIDER,
  ...HEALTHCARE,
  ...DTC_TELEHEALTH,
  ...AT_HOME_TESTING,
  ...MEDICAL_EQUIPMENT,
  ...TAX_FINANCE,
  ...MEAL_KITS,
  ...HEALTH_TECH,
  ...EVENT_VENDORS,
  ...LEGAL,
  ...CANNABIS,
  ...NIGHTLIFE,
  ...TUTORING,
  ...HOME_SERVICES,
  ...KIDS_ACTIVITIES,
  ...VISION_RETAIL,
  ...HEARING,
  ...SPECIALTY_EXPANDED,
  ...DIGITAL,
];

export const UNIVERSE_CATEGORIES = {
  GROCERY, BIG_BOX, FOOD, GAS, SUBSCRIPTIONS, UTILITIES, TRAVEL, AUTO,
  ENTERTAINMENT, PERSONAL_CARE, FITNESS, PETS, INSURANCE, FINANCIAL,
  HOUSING, CHILDCARE_EDU, CLOTHING, MARKETPLACES, GOVERNMENT, CHARITY,
  WELLNESS_NON_CLINICAL, DR_PREFIX_TRAPS, HEALTHCARE_PLATFORMS_NON_PROVIDER,
  HEALTHCARE, DTC_TELEHEALTH, AT_HOME_TESTING, MEDICAL_EQUIPMENT, TAX_FINANCE,
  MEAL_KITS, HEALTH_TECH, EVENT_VENDORS, LEGAL, CANNABIS, NIGHTLIFE,
  TUTORING, HOME_SERVICES, KIDS_ACTIVITIES, VISION_RETAIL, HEARING,
  SPECIALTY_EXPANDED, DIGITAL,
};
