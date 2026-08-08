export type CurrencyOption = {
  code: string;
  label: string;
};

const FALLBACK_CURRENCY_CODES = [
  "AED",
  "ARS",
  "AUD",
  "BDT",
  "BGN",
  "BHD",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CZK",
  "DKK",
  "EGP",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "JPY",
  "KES",
  "KRW",
  "KWD",
  "MXN",
  "MYR",
  "NGN",
  "NOK",
  "NZD",
  "OMR",
  "PEN",
  "PHP",
  "PKR",
  "PLN",
  "QAR",
  "RON",
  "RUB",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "UAH",
  "USD",
  "VND",
  "ZAR",
] as const;

function resolveCurrencyCodes(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      return Intl.supportedValuesOf("currency");
    } catch {
      return [...FALLBACK_CURRENCY_CODES];
    }
  }
  return [...FALLBACK_CURRENCY_CODES];
}

function formatCurrencyLabel(code: string): string {
  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
      const name = displayNames.of(code);
      if (name && name !== code) {
        return `${code} — ${name}`;
      }
    } catch {
      // Fall through to code-only label.
    }
  }
  return code;
}

let cachedOptions: CurrencyOption[] | null = null;

export function getSupportedCurrencyOptions(): CurrencyOption[] {
  if (cachedOptions) return cachedOptions;

  cachedOptions = resolveCurrencyCodes()
    .map((code) => ({
      code,
      label: formatCurrencyLabel(code),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return cachedOptions;
}

export function findCurrencyOption(code: string): CurrencyOption | undefined {
  const normalized = code.trim().toUpperCase();
  return getSupportedCurrencyOptions().find((option) => option.code === normalized);
}
