/**
 * US ZIP → state (two-letter) lookup using the first two digits.
 * Good enough for biasing NPI search; not authoritative for billing
 * or shipping. Some prefixes span multiple states (e.g. 02 covers
 * both MA and RI) — picks the dominant one in those cases.
 *
 * Without this, NPI search defaults to "wherever the registry felt
 * like" and users in CT see Yonkers, NY results for unscoped names.
 */

const PREFIX_TO_STATE: Record<string, string> = {
  "00": "MA", "01": "MA", "02": "MA",
  "03": "NH", "04": "ME", "05": "VT",
  "06": "CT", "07": "NJ", "08": "NJ",
  "10": "NY", "11": "NY", "12": "NY", "13": "NY", "14": "NY",
  "15": "PA", "16": "PA", "17": "PA", "18": "PA", "19": "PA",
  "20": "DC", "21": "MD", "22": "VA", "23": "VA", "24": "VA",
  "25": "WV", "26": "WV", "27": "NC", "28": "NC", "29": "SC",
  "30": "GA", "31": "GA", "32": "FL", "33": "FL", "34": "FL",
  "35": "AL", "36": "AL", "37": "TN", "38": "TN", "39": "MS",
  "40": "KY", "41": "KY", "42": "KY", "43": "OH", "44": "OH", "45": "OH",
  "46": "IN", "47": "IN", "48": "MI", "49": "MI",
  "50": "IA", "51": "IA", "52": "IA", "53": "WI", "54": "WI",
  "55": "MN", "56": "MN", "57": "SD", "58": "ND", "59": "MT",
  "60": "IL", "61": "IL", "62": "IL", "63": "MO", "64": "MO", "65": "MO",
  "66": "KS", "67": "KS", "68": "NE", "69": "NE",
  "70": "LA", "71": "LA", "72": "AR", "73": "OK", "74": "OK",
  "75": "TX", "76": "TX", "77": "TX", "78": "TX", "79": "TX",
  "80": "CO", "81": "CO", "82": "WY", "83": "ID", "84": "UT",
  "85": "AZ", "86": "AZ", "87": "NM", "88": "NM", "89": "NV",
  "90": "CA", "91": "CA", "92": "CA", "93": "CA", "94": "CA", "95": "CA",
  "97": "OR", "98": "WA", "99": "AK",
};

export function zipToState(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const cleaned = String(zip).replace(/\D/g, "");
  if (cleaned.length < 2) return null;
  return PREFIX_TO_STATE[cleaned.slice(0, 2)] || null;
}
