/**
 * Building an academy's format from its stored settings, plus money and time
 * zone names. Kept apart from academy-format.ts so the formatters every page
 * loads stay small (learner first-load budget, audit H16).
 */
import {
  currentAcademyFormat,
  DEFAULT_ACADEMY_FORMAT,
  DEFAULT_CURRENCY,
  type AcademyFormat,
} from "./academy-format";

/**
 * The locale that writes numbers and dates the way the academy's own market
 * does: lakh grouping and "25 Nov 2026" for India, "Nov 25, 2026" for the US.
 */
export function formatLocaleForCurrency(currency: string | null | undefined): string {
  switch ((currency ?? DEFAULT_CURRENCY).toUpperCase()) {
    case "INR":
      return "en-IN";
    case "USD":
      return "en-US";
    case "GBP":
      return "en-GB";
    case "EUR":
      return "en-IE";
    case "AUD":
      return "en-AU";
    case "CAD":
      return "en-CA";
    case "SGD":
      return "en-SG";
    case "AED":
      return "en-AE";
    default:
      return "en-GB";
  }
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Builds the academy's format from its stored settings, filling gaps with defaults. */
export function academyFormatFrom(settings: {
  timeZone?: string | null | undefined;
  currency?: string | null | undefined;
}): AcademyFormat {
  const currency = (settings.currency?.trim() || DEFAULT_CURRENCY).toUpperCase();
  const zone = settings.timeZone?.trim();
  return {
    timeZone: zone && isValidTimeZone(zone) ? zone : DEFAULT_ACADEMY_FORMAT.timeZone,
    locale: formatLocaleForCurrency(currency),
    currency,
  };
}

/**
 * An amount in minor units (paise, cents) as money, such as "₹1,499" or
 * "₹1,499.50". The currency defaults to the academy's home currency.
 */
export function formatMoneyMinor(
  amountMinor: number,
  currency?: string | null,
  format: AcademyFormat = currentAcademyFormat(),
): string {
  const code = (currency?.trim() || format.currency).toUpperCase();
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(format.locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${code} ${major.toFixed(2)}`;
  }
}

/** "India Standard Time", for labelling times shown in the academy's zone. */
export function timeZoneName(
  timeZone: string = currentAcademyFormat().timeZone,
  at: Date = new Date(),
): string {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "long" })
      .formatToParts(at)
      .find((entry) => entry.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
