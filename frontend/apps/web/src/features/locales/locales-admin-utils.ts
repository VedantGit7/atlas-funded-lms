export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      diffMinutes,
      "minute",
    );
  }
  const diffHours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 48) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffHours, "hour");
  }
  return date.toLocaleString();
}

export function truncateText(value: string, maxLength = 80): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function mergeLocaleOptions(
  existingLocales: string[],
  commonValues: readonly { value: string; label: string }[],
) {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  for (const locale of existingLocales.sort()) {
    if (seen.has(locale)) continue;
    seen.add(locale);
    options.push({ value: locale, label: `${locale} (tenant)` });
  }

  for (const entry of commonValues) {
    if (seen.has(entry.value)) continue;
    seen.add(entry.value);
    options.push(entry);
  }

  return options;
}
