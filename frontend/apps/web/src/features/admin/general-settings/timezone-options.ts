export type TimezoneOption = {
  value: string;
  label: string;
};

function formatTimezoneLabel(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return `${offset} ${timeZone.replace(/_/g, " ")}`.trim();
  } catch {
    return timeZone.replace(/_/g, " ");
  }
}

export function listTimezoneOptions(): TimezoneOption[] {
  return Intl.supportedValuesOf("timeZone")
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
}

export function formatTimezoneValue(timeZone: string): string {
  return formatTimezoneLabel(timeZone);
}

export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
