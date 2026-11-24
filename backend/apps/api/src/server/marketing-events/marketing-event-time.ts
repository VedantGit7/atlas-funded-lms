/**
 * Event times in the academy's time zone, with the zone named (QA review 2
 * H29: the event page and emails gave a time with no zone, so a visitor in
 * another country couldn't tell when to join).
 */

const LOCALE = "en-GB";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The academy's zone, or UTC when the stored value isn't a real IANA zone. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  const value = timeZone?.trim() ?? "";
  return value && isValidTimeZone(value) ? value : "UTC";
}

/** "India Standard Time", "Coordinated Universal Time", … */
export function timeZoneLongName(timeZone: string, at: Date = new Date()): string {
  const zone = safeTimeZone(timeZone);
  const part = new Intl.DateTimeFormat(LOCALE, { timeZone: zone, timeZoneName: "long" })
    .formatToParts(at)
    .find((entry) => entry.type === "timeZoneName");
  return part?.value ?? zone;
}

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * "Monday 1 December 2026, 6:30 pm – 8:00 pm (India Standard Time)".
 * An end on another day repeats the date.
 */
export function formatEventWhen(
  startsAt: Date,
  endsAt: Date | null,
  timeZone: string | null | undefined,
): string {
  const zone = safeTimeZone(timeZone);
  const startDate = formatDate(startsAt, zone);
  const start = `${startDate}, ${formatTime(startsAt, zone)}`;
  const zoneName = timeZoneLongName(zone, startsAt);
  if (!endsAt) return `${start} (${zoneName})`;
  const endDate = formatDate(endsAt, zone);
  const end =
    endDate === startDate ? formatTime(endsAt, zone) : `${endDate}, ${formatTime(endsAt, zone)}`;
  return `${start} – ${end} (${zoneName})`;
}
