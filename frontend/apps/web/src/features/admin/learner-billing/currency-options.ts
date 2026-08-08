import { getSupportedCurrencyOptions } from "../../courses/supported-currencies";

export type CurrencyChoice = { code: string; name: string };

/** Localized currency name (e.g. "Indian Rupee"), falling back to the code. */
export function currencyName(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(normalized);
      if (name && name !== normalized) {
        return name;
      }
    } catch {
      // fall through
    }
  }
  return normalized;
}

let cached: CurrencyChoice[] | null = null;

/** Every ISO 4217 currency the runtime knows, sorted by display name. */
export function getAllCurrencies(): CurrencyChoice[] {
  if (cached) return cached;
  cached = getSupportedCurrencyOptions()
    .map((option) => ({ code: option.code, name: currencyName(option.code) ?? option.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}
