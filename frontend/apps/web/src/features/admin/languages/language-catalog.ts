export type LanguageChoice = {
  code: string;
  name: string;
  nativeName: string;
};

/**
 * ISO 639-1 two-letter language codes (matches the backend localeCodeSchema,
 * which accepts `[a-z]{2}` with an optional region). Names are derived at
 * runtime from Intl.DisplayNames so we never hardcode translated strings.
 */
const LANGUAGE_CODES = [
  "af","am","ar","az","be","bg","bn","bs","ca","cs","cy","da","de","el","en","es","et","eu",
  "fa","fi","fil","fr","ga","gl","gu","ha","he","hi","hr","hu","hy","id","ig","is","it","ja",
  "jv","ka","kk","km","kn","ko","ku","ky","lo","lt","lv","mk","ml","mn","mr","ms","mt","my",
  "ne","nl","no","or","pa","pl","ps","pt","ro","ru","rw","sd","si","sk","sl","so","sq","sr",
  "sv","sw","ta","te","tg","th","ti","tk","tr","tt","ug","uk","ur","uz","vi","xh","yi","yo",
  "zh","zu",
];

const RTL_CODES = new Set(["ar", "fa", "he", "ur", "ps", "ku", "sd", "ug", "yi", "dv"]);

function displayName(code: string, inLocale: string): string {
  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const name = new Intl.DisplayNames([inLocale], { type: "language" }).of(code);
      if (name && name.toLowerCase() !== code.toLowerCase()) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch {
      // fall through
    }
  }
  return code;
}

export function languageName(code: string): string {
  return displayName(code, "en");
}

export function nativeLanguageName(code: string): string {
  return displayName(code, code);
}

export function isRtlLanguage(code: string): boolean {
  const base = code.split(/[-_]/)[0] ?? code;
  return RTL_CODES.has(base.toLowerCase());
}

let cached: LanguageChoice[] | null = null;

/** All offerable languages, sorted by English name. */
export function getAllLanguages(): LanguageChoice[] {
  if (cached) return cached;
  cached = LANGUAGE_CODES.map((code) => ({
    code,
    name: languageName(code),
    nativeName: nativeLanguageName(code),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}
