/**
 * Local preferences for Certificate Studio Templates gallery.
 * Favorites + use counts (no fake marketing numbers).
 */

const FAVORITES_KEY = "certificate-studio:template-favorites";
const USAGE_KEY = "certificate-studio:template-usage";

/** localStorage is untrusted input, so callers must narrow the result. */
function readJson(key: string): unknown {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

export function loadTemplateFavorites(): string[] {
  const list = readJson(FAVORITES_KEY);
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
}

export function saveTemplateFavorites(ids: string[]): void {
  writeJson(FAVORITES_KEY, ids);
}

export function loadTemplateUsage(): Record<string, number> {
  const map = readJson(USAGE_KEY);
  if (typeof map !== "object" || map === null || Array.isArray(map)) return {};
  // Drop corrupt entries: `bumpTemplateUsage` does arithmetic on these values,
  // and a non-number would silently produce NaN.
  return Object.fromEntries(
    Object.entries(map).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

export function bumpTemplateUsage(id: string): Record<string, number> {
  const map = loadTemplateUsage();
  map[id] = (map[id] ?? 0) + 1;
  writeJson(USAGE_KEY, map);
  return map;
}

export function formatUsageLabel(count: number | undefined): string | null {
  if (!count || count < 1) return null;
  if (count === 1) return "Used once";
  return `Used ${count}×`;
}
