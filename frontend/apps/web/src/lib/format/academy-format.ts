/**
 * One way to show dates, times, counts and money across the app (QA review 1
 * M34, m14, m15; review 2 4.3.5).
 *
 * Every screen formats in the academy's own time zone and locale, so an admin
 * in Mumbai and a server in UTC print the same "25 Nov 2026, 6:30 pm". That
 * also ends React's hydration error #418, which came from the server rendering
 * dates in its own clock and the browser re-rendering them in the viewer's.
 *
 * The functions read the academy's settings from `AcademyFormatProvider`
 * (academy-format-context.tsx), which the root layout mounts with the values
 * from the public bootstrap. Building the settings, money and zone names live
 * in academy-settings.ts, so this core stays small in every page's bundle. Server components, which sit outside that
 * provider, pass the settings in themselves (`loadAcademyFormat`).
 */

export type AcademyFormat = {
  /** IANA zone, such as "Asia/Kolkata". */
  timeZone: string;
  /** BCP 47 locale used for every date and number, such as "en-IN". */
  locale: string;
  /** ISO 4217 home currency, such as "INR". */
  currency: string;
};

/** The academy's home currency when none is set: the platform serves Indian academies first. */
export const DEFAULT_CURRENCY = "INR";

/** Used before an academy is known (platform host, tests). */
export const DEFAULT_ACADEMY_FORMAT: AcademyFormat = {
  timeZone: "UTC",
  locale: "en-IN",
  currency: DEFAULT_CURRENCY,
};

type FormatResolver = () => AcademyFormat;

let resolver: FormatResolver = () => DEFAULT_ACADEMY_FORMAT;

/** Installed once by academy-format-context.tsx; nothing else should call it. */
export function setAcademyFormatResolver(next: FormatResolver): void {
  resolver = next;
}

/** The academy's format for the code running now (a render, a click handler, an export). */
export function currentAcademyFormat(): AcademyFormat {
  return resolver();
}

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Like `date.toLocaleDateString(options)`, in the academy's zone and locale. */
export function formatDate(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  format: AcademyFormat = currentAcademyFormat(),
): string {
  return toDate(value).toLocaleDateString(format.locale, {
    timeZone: format.timeZone,
    ...options,
  });
}

/** Like `date.toLocaleString(options)`, in the academy's zone and locale. */
export function formatDateTime(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  format: AcademyFormat = currentAcademyFormat(),
): string {
  return toDate(value).toLocaleString(format.locale, { timeZone: format.timeZone, ...options });
}

/** Like `date.toLocaleTimeString(options)`, in the academy's zone and locale. */
export function formatTime(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  format: AcademyFormat = currentAcademyFormat(),
): string {
  return toDate(value).toLocaleTimeString(format.locale, {
    timeZone: format.timeZone,
    ...options,
  });
}

/** An `Intl.DateTimeFormat` in the academy's zone and locale. Create it where it is used, not at module load. */
export function academyDateTimeFormat(
  options?: Intl.DateTimeFormatOptions,
  format: AcademyFormat = currentAcademyFormat(),
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(format.locale, { timeZone: format.timeZone, ...options });
}

/** Like `value.toLocaleString(options)` for a number, grouped the academy's way. */
export function formatNumber(
  value: number | bigint,
  options?: Intl.NumberFormatOptions,
  format: AcademyFormat = currentAcademyFormat(),
): string {
  return new Intl.NumberFormat(format.locale, options).format(value);
}
