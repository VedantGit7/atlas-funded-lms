/**
 * Local preferences for Certificate Studio Templates gallery.
 * Favorites + use counts (no fake marketing numbers).
 */

const FAVORITES_KEY = "certificate-studio:template-favorites";
const USAGE_KEY = "certificate-studio:template-usage";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
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
  const list = readJson<string[]>(FAVORITES_KEY, []);
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

export function saveTemplateFavorites(ids: string[]): void {
  writeJson(FAVORITES_KEY, ids);
}

export function loadTemplateUsage(): Record<string, number> {
  const map = readJson<Record<string, number>>(USAGE_KEY, {});
  if (!map || typeof map !== "object") return {};
  return map;
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
