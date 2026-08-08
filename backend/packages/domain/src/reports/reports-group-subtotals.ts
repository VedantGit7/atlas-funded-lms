import type { ReportDatasetResult } from "./reports.types";

export type PaymentExportGrouping = "none" | "gateway" | "product" | "currency" | "month";

const GROUP_COLUMN = "_group";
const SUBTOTAL_FLAG = "_is_subtotal";

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return "";
}

function monthKey(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "Unknown month";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 7) || "Unknown month";
  return date.toISOString().slice(0, 7);
}

function groupKeyForRow(
  row: Record<string, unknown>,
  grouping: Exclude<PaymentExportGrouping, "none">,
): string {
  if (grouping === "gateway") {
    return asString(row["gateway_key"]) || "Unknown gateway";
  }
  if (grouping === "product") {
    return asString(row["product_title"]) || "Unknown product";
  }
  if (grouping === "currency") {
    return (asString(row["currency"]) || "UNK").toUpperCase();
  }
  return monthKey(row["paid_at"] ?? row["created_at"]);
}

function sumCents(rows: Array<Record<string, unknown>>, column: string): number {
  let total = 0;
  for (const row of rows) {
    const value = row[column];
    if (typeof value === "number" && Number.isFinite(value)) total += value;
    else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) total += parsed;
    }
  }
  return total;
}

function pickAmountColumn(columns: string[]): string | null {
  if (columns.includes("amount_cents")) return "amount_cents";
  if (columns.includes("total_amount_cents")) return "total_amount_cents";
  return null;
}

/**
 * Groups payment export rows and optionally inserts per-group subtotal rows.
 * Cross-currency totals are avoided: currency grouping keeps groups separate;
 * other groupings only sum amount when all rows share one currency.
 */
export function applyPaymentExportGrouping(
  dataset: ReportDatasetResult,
  grouping: PaymentExportGrouping,
  includeSubtotals: boolean,
): ReportDatasetResult {
  if (grouping === "none" || dataset.rows.length === 0) {
    return dataset;
  }

  const buckets = new Map<string, Array<Record<string, unknown>>>();
  for (const row of dataset.rows) {
    const key = groupKeyForRow(row, grouping);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  const amountColumn = pickAmountColumn(dataset.columns);
  const taxColumn = dataset.columns.includes("tax_amount_cents") ? "tax_amount_cents" : null;
  const couponColumn = dataset.columns.includes("coupon_amount_cents")
    ? "coupon_amount_cents"
    : null;
  const remainingColumn = dataset.columns.includes("remaining_amount_cents")
    ? "remaining_amount_cents"
    : null;

  const columns = dataset.columns.includes(GROUP_COLUMN)
    ? dataset.columns
    : [GROUP_COLUMN, ...dataset.columns];

  const rows: Array<Record<string, unknown>> = [];
  for (const key of sortedKeys) {
    const groupRows = buckets.get(key) ?? [];
    for (const row of groupRows) {
      rows.push({ ...row, [GROUP_COLUMN]: key, [SUBTOTAL_FLAG]: false });
    }

    if (!includeSubtotals) continue;

    const currencies = new Set(
      groupRows
        .map((row) => asString(row["currency"]).toUpperCase())
        .filter((value) => value.length > 0),
    );
    const singleCurrency = currencies.size <= 1;
    const subtotal: Record<string, unknown> = {
      [GROUP_COLUMN]: key,
      [SUBTOTAL_FLAG]: true,
    };
    for (const column of dataset.columns) {
      subtotal[column] = null;
    }
    if (dataset.columns.includes("learner_name")) {
      subtotal["learner_name"] = `SUBTOTAL · ${key}`;
    } else if (dataset.columns.includes("product_title")) {
      subtotal["product_title"] = `SUBTOTAL · ${key}`;
    }
    if (dataset.columns.includes("status")) {
      subtotal["status"] = `${String(groupRows.length)} rows`;
    }
    if (singleCurrency && amountColumn) {
      subtotal[amountColumn] = sumCents(groupRows, amountColumn);
    }
    if (singleCurrency && taxColumn) {
      subtotal[taxColumn] = sumCents(groupRows, taxColumn);
    }
    if (singleCurrency && couponColumn) {
      subtotal[couponColumn] = sumCents(groupRows, couponColumn);
    }
    if (singleCurrency && remainingColumn) {
      subtotal[remainingColumn] = sumCents(groupRows, remainingColumn);
    }
    if (singleCurrency && currencies.size === 1 && dataset.columns.includes("currency")) {
      subtotal["currency"] = [...currencies][0];
    }
    rows.push(subtotal);
  }

  return { columns, rows };
}

export function isSubtotalRow(row: Record<string, unknown>): boolean {
  return row[SUBTOTAL_FLAG] === true;
}
