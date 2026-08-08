import type { VizType } from "./types";

const STORAGE_PREFIX = "atlas-viz-pref:";

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function getPreferredVizType(key: string): VizType | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(storageKey(key));
    return value as VizType | null;
  } catch {
    return null;
  }
}

export function setPreferredVizType(key: string, vizType: VizType): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(key), vizType);
  } catch {
    // Ignore quota / privacy mode errors.
  }
}
