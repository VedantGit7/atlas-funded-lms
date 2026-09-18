/**
 * Typed readers for raw-SQL result columns.
 *
 * The report repositories run `tx.$queryRaw<Array<Record<string, unknown>>>`
 * and then coerce each column with `String(row["x"])`. That is what
 * `@typescript-eslint/no-base-to-string` flags, and the warning is real: when a
 * column comes back as an object — a `json`/`jsonb` column, an array, a driver
 * type that is not a primitive — `String()` yields the literal text
 * `"[object Object]"`, and that string is written straight into a CSV or XLSX
 * export and handed to an academy admin.
 *
 * `textColumn` keeps the existing behaviour for every primitive and for `Date`,
 * and returns the fallback instead of `"[object Object]"` for values that have
 * no meaningful string form. The only behavioural change is on the path that
 * was already producing garbage.
 */

/** Values whose default `String()` conversion is meaningful. */
function isStringable(value: unknown): value is string | number | bigint | boolean | Date {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Date
  );
}

/** Reads a column as text. Returns `fallback` for null/undefined and for non-stringable values. */
export function textColumn(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (isStringable(value)) return String(value);
  return fallback;
}

/** Reads a nullable column as text, preserving null rather than coercing it. */
export function nullableTextColumn(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isStringable(value) ? String(value) : null;
}
