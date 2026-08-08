export type LocationChoice = { key: string; title: string; flag: string };

/** ISO 3166-1 alpha-2 country codes (source list for the location picker). */
const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AR","AT","AU","AZ","BA","BB","BD","BE","BF","BG","BH","BI",
  "BJ","BN","BO","BR","BS","BT","BW","BY","BZ","CA","CD","CF","CG","CH","CI","CL","CM","CN","CO","CR",
  "CU","CV","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","ER","ES","ET","FI","FJ","FM","FR",
  "GA","GB","GD","GE","GH","GM","GN","GQ","GR","GT","GW","GY","HN","HR","HT","HU","ID","IE","IL","IN",
  "IQ","IR","IS","IT","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KZ","LA","LB","LC",
  "LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MG","MH","MK","ML","MM","MN","MR","MT",
  "MU","MV","MW","MX","MY","MZ","NA","NE","NG","NI","NL","NO","NP","NR","NZ","OM","PA","PE","PG","PH",
  "PK","PL","PT","PW","PY","QA","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SI","SK","SL","SM",
  "SN","SO","SR","SS","ST","SV","SY","SZ","TD","TG","TH","TJ","TL","TM","TN","TO","TR","TT","TV","TW",
  "TZ","UA","UG","US","UY","UZ","VA","VC","VE","VN","VU","WS","YE","ZA","ZM","ZW",
];

export function flagFor(key: string): string {
  if (key.length !== 2) return "\u{1F310}"; // globe for non-country keys (e.g. ROW)
  const base = 0x1f1e6;
  const code = key.toUpperCase();
  return String.fromCodePoint(base + (code.charCodeAt(0) - 65), base + (code.charCodeAt(1) - 65));
}

function countryName(code: string): string {
  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (name && name !== code) {
        return name;
      }
    } catch {
      // fall through
    }
  }
  return code;
}

let cached: LocationChoice[] | null = null;

/** All locations for the picker: "Rest of the World" first, then every country. */
export function getAllLocations(): LocationChoice[] {
  if (cached) return cached;
  const countries = COUNTRY_CODES.map((code) => ({
    key: code,
    title: countryName(code),
    flag: flagFor(code),
  })).sort((a, b) => a.title.localeCompare(b.title));
  cached = [{ key: "ROW", title: "Rest of the World", flag: flagFor("ROW") }, ...countries];
  return cached;
}

export function locationTitle(key: string): string {
  if (key === "ROW") return "Rest of the World";
  return countryName(key.toUpperCase());
}

/** Narrow currency symbol for a code, e.g. "₹" for INR. */
export function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}
