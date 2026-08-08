import type { NormalizedColumn, NormalizedResult, NormalizedRow } from "./types";

function inferKind(value: string | number | null | undefined): NormalizedColumn["kind"] {
  if (typeof value === "number") return "number";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "string";
}

export function emptyNormalizedResult(): NormalizedResult {
  return { columns: [], rows: [] };
}

export function normalizeTabularData(args: {
  columns: Array<{ key: string; label: string; kind?: NormalizedColumn["kind"] }>;
  rows: NormalizedRow[];
  dimensions?: string[];
  measures?: string[];
}): NormalizedResult {
  const columns: NormalizedColumn[] = args.columns.map((column) => ({
    key: column.key,
    label: column.label,
    kind: column.kind ?? inferKind(args.rows[0]?.[column.key]),
  }));

  const dimensions =
    args.dimensions ?? columns.filter((column) => column.kind === "dimension").map((column) => column.key);
  const measures =
    args.measures ?? columns.filter((column) => column.kind === "measure" || column.kind === "number").map((column) => column.key);

  return {
    columns,
    rows: args.rows,
    dimensions,
    measures,
  };
}

export function normalizeFromRecords(
  records: Array<Record<string, string | number | null>>,
  columnLabels?: Record<string, string>,
): NormalizedResult {
  if (records.length === 0) {
    return emptyNormalizedResult();
  }

  const keys = Object.keys(records[0] ?? {});
  const columns = keys.map((key) => ({
    key,
    label: columnLabels?.[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    kind: inferKind(records[0]?.[key]),
  }));

  return normalizeTabularData({ columns, rows: records });
}

export function aggregatePivot(
  data: NormalizedResult,
  dimensionKey?: string,
  measureKey?: string,
): NormalizedResult {
  const dimension = dimensionKey ?? data.dimensions?.[0] ?? data.columns.find((column) => column.kind === "dimension")?.key;
  const measure = measureKey ?? data.measures?.[0] ?? data.columns.find((column) => column.kind === "measure" || column.kind === "number")?.key;

  if (!dimension || !measure) {
    return data;
  }

  const totals = new Map<string, number>();
  for (const row of data.rows) {
    const label = String(row[dimension] ?? "Unknown");
    const value = typeof row[measure] === "number" ? row[measure] : Number(row[measure]) || 0;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }

  const rows: NormalizedRow[] = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, total]) => ({
      [dimension]: label,
      [measure]: total,
    }));

  return normalizeTabularData({
    columns: [
      { key: dimension, label: data.columns.find((column) => column.key === dimension)?.label ?? dimension, kind: "dimension" },
      { key: measure, label: data.columns.find((column) => column.key === measure)?.label ?? measure, kind: "measure" },
    ],
    rows,
    dimensions: [dimension],
    measures: [measure],
  });
}

export function firstMeasureValue(data: NormalizedResult): number | null {
  const measureKey =
    data.measures?.[0] ??
    data.columns.find((column) => column.kind === "measure" || column.kind === "number")?.key;
  if (!measureKey || data.rows.length === 0) return null;
  const value = data.rows[0]?.[measureKey];
  return typeof value === "number" ? value : Number(value) || null;
}

export function firstMeasureLabel(data: NormalizedResult): string {
  const measureKey =
    data.measures?.[0] ??
    data.columns.find((column) => column.kind === "measure" || column.kind === "number")?.key;
  if (!measureKey) return "Value";
  return data.columns.find((column) => column.key === measureKey)?.label ?? measureKey;
}
