export const SALES_INVERT_FOOTNOTE = "Higher is worse.";
export const SALES_FIXED_WINDOW_FOOTNOTE =
  "Sales Insight uses fixed windows shown in each widget title.";
export const SALES_OPPORTUNITY_FOOTNOTE =
  "Online is a rollup of paid, free, and trial. These segments overlap and do not sum to the learner total.";
export const SALES_PIPELINE_EMPTY_CAPTION = "No pipeline events recorded.";

export const SALES_INSIGHT_REVENUE_KPI_IDS = [
  "revenue",
  "revenue-30d",
  "paid-orders",
  "failed-orders",
] as const;

export const SALES_INSIGHT_CATALOGUE_KPI_IDS = [
  "products",
  "learners",
  "paid-enrollments",
  "trial-free-pool",
] as const;

export const SALES_INSIGHT_CONVERSION_KPI_IDS = [
  "conversion-rate",
  "conversion-rate-30d",
  "enrollments-30d",
  "paid-enrollments-30d",
] as const;

export const SALES_INSIGHT_MONEY_KPI_IDS = new Set(["revenue", "revenue-30d"]);
export const SALES_INSIGHT_PERCENT_KPI_IDS = new Set(["conversion-rate", "conversion-rate-30d"]);
export const SALES_INSIGHT_INVERTED_KPI_IDS = new Set(["failed-orders"]);

export const SALES_INSIGHT_CHART_WIDGET_IDS = [
  "monthly-revenue",
  "pipeline",
  "pipeline-30d",
  "enrollment-channels",
  "payment-orders",
  "top-products",
  "top-sources",
  "opportunity-pool",
  "failed-payments",
] as const;

export type SalesPipelineCounts = {
  visited: number;
  startedDiagnostic: number;
  enrolled: number;
};

export type SalesMonthPoint = {
  period: string;
  amountMajor: number;
};

function formatUtcMonth(period: string): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period.slice(0, 7);
  return date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

function formatMajorMoney(value: number, currency: string): string {
  const amount = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${currency}`;
}

/** Visited-to-enrolled rate, whole number. Zero visits never become 0%. */
export function salesConversionRate(visited: number, enrolled: number): number | null {
  if (visited <= 0) return null;
  return Math.round((enrolled / visited) * 100);
}

export function salesConversionDisplay(visited: number, enrolled: number): string {
  const rate = salesConversionRate(visited, enrolled);
  return rate == null ? "-" : `${rate}%`;
}

export function salesStepConversion(from: number, to: number): string {
  if (from <= 0) return "-";
  return `${Math.round((to / from) * 100)}%`;
}

/** Stage-to-stage rate to one decimal. Null when the prior stage is empty. */
export function salesStepConversionPct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return Math.round((to / from) * 1000) / 10;
}

export function salesFormatPct(value: number | null): string {
  if (value == null) return "-";
  if (Number.isInteger(value)) return `${String(value)}%`;
  return `${value.toFixed(1)}%`;
}

export function salesFormatSignedPts(value: number | null): string {
  if (value == null) return "-";
  if (value === 0) return "0 pts";
  const abs = Math.abs(value);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  const sign = value > 0 ? "+" : "-";
  return `${sign}${text} pts`;
}

export function salesDropoffCount(from: number, to: number): number {
  return Math.max(from - to, 0);
}

/** Names the leakier sequential transition in plain language. */
export function salesLeakCaption(
  allTime: SalesPipelineCounts,
  last30d: SalesPipelineCounts,
): string | null {
  const pipeline = allTime.visited > 0 ? allTime : last30d;
  if (pipeline.visited <= 0) return null;
  const dropStart = salesDropoffCount(pipeline.visited, pipeline.startedDiagnostic);
  const dropEnroll = salesDropoffCount(pipeline.startedDiagnostic, pipeline.enrolled);
  if (dropStart <= 0 && dropEnroll <= 0) return null;
  if (dropStart >= dropEnroll) return "Most visitors never start a diagnostic.";
  return "Most learners who start a diagnostic do not enroll.";
}

export function salesPipelineCaption(pipeline: SalesPipelineCounts): string {
  const rate = salesConversionRate(pipeline.visited, pipeline.enrolled);
  if (rate == null) return SALES_PIPELINE_EMPTY_CAPTION;
  return `${rate}% visited to enrolled.`;
}

export function salesPipelinePairCaption(
  allTime: SalesPipelineCounts,
  last30d: SalesPipelineCounts,
): string | undefined {
  const allRate = salesConversionRate(allTime.visited, allTime.enrolled);
  const recentRate = salesConversionRate(last30d.visited, last30d.enrolled);
  if (allRate == null && recentRate == null) return SALES_PIPELINE_EMPTY_CAPTION;
  if (allRate == null || recentRate == null) return undefined;
  const diff = recentRate - allRate;
  if (diff === 0) return "Conversion in the last 30 days matches all time.";
  const abs = Math.abs(diff);
  const points = abs === 1 ? "point" : "points";
  if (diff > 0) {
    return `Conversion is ${abs} ${points} higher in the last 30 days than all time.`;
  }
  return `Conversion is ${abs} ${points} lower in the last 30 days than all time.`;
}

export function salesMonthlyRevenueCaption(
  series: SalesMonthPoint[],
  currency: string,
): string | undefined {
  const first = series[0];
  if (!first) return undefined;
  let highest = first;
  let lowest = first;
  let anyPaid = first.amountMajor > 0;
  for (const row of series) {
    if (row.amountMajor > 0) anyPaid = true;
    if (row.amountMajor > highest.amountMajor) highest = row;
    if (row.amountMajor < lowest.amountMajor) lowest = row;
  }
  if (!anyPaid) return "No paid revenue in the last 12 months.";
  return `Highest revenue in ${formatUtcMonth(highest.period)} (${formatMajorMoney(highest.amountMajor, currency)}), lowest in ${formatUtcMonth(lowest.period)} (${formatMajorMoney(lowest.amountMajor, currency)}).`;
}
