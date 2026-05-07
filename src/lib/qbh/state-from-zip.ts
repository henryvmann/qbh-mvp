// US zip-prefix → state code. Used to scope third-party lookups
// (Google Places) to the user's state so we don't return same-named
// businesses from other states.

const RANGES: Array<[[string, string], string]> = [
  [["010", "027"], "MA"], [["028", "029"], "RI"], [["030", "038"], "NH"],
  [["039", "049"], "ME"], [["050", "059"], "VT"], [["060", "069"], "CT"],
  [["070", "089"], "NJ"], [["100", "149"], "NY"],
  [["150", "196"], "PA"], [["197", "199"], "DE"], [["200", "205"], "DC"],
  [["206", "219"], "MD"], [["220", "246"], "VA"], [["247", "268"], "WV"],
  [["270", "289"], "NC"], [["290", "299"], "SC"], [["300", "319"], "GA"],
  [["320", "349"], "FL"], [["350", "369"], "AL"], [["370", "385"], "TN"],
  [["386", "397"], "MS"], [["400", "427"], "KY"], [["430", "459"], "OH"],
  [["460", "479"], "IN"], [["480", "499"], "MI"], [["500", "528"], "IA"],
  [["530", "549"], "WI"], [["550", "567"], "MN"], [["570", "577"], "SD"],
  [["580", "588"], "ND"], [["590", "599"], "MT"], [["600", "629"], "IL"],
  [["630", "658"], "MO"], [["660", "679"], "KS"], [["680", "693"], "NE"],
  [["700", "714"], "LA"], [["716", "729"], "AR"], [["730", "749"], "OK"],
  [["750", "799"], "TX"], [["800", "816"], "CO"], [["820", "831"], "WY"],
  [["832", "838"], "ID"], [["840", "847"], "UT"], [["850", "865"], "AZ"],
  [["870", "884"], "NM"], [["889", "898"], "NV"], [["900", "961"], "CA"],
  [["970", "979"], "OR"], [["980", "994"], "WA"], [["995", "999"], "AK"],
  [["967", "968"], "HI"],
];

export function stateFromZip(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const trimmed = String(zip).trim();
  const prefix = trimmed.slice(0, 3);
  const n = parseInt(prefix, 10);
  if (Number.isNaN(n)) return null;
  for (const [[from, to], state] of RANGES) {
    if (n >= parseInt(from, 10) && n <= parseInt(to, 10)) return state;
  }
  return null;
}
