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
export const SALES_INSIGHT_INVERTED_WIDGET_IDS = new Set(["failed-orders", "failed-payments"]);
export const SALES_INSIGHT_FUNNEL_IDS = new Set(["pipeline", "pipeline-30d"]);
export const SALES_INSIGHT_TABLE_IDS = new Set([
  "top-products",
  "top-sources",
  "opportunity-pool",
  "failed-payments",
]);
export const SALES_INSIGHT_MONEY_WIDGET_IDS = new Set([
  "revenue",
  "revenue-30d",
  "monthly-revenue",
  "top-products",
  "top-sources",
  "failed-payments",
]);

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

export const SALES_PIPELINE_EMPTY_CAPTION = "No pipeline events recorded.";
export const SALES_FIXED_WINDOW_CAPTION =
  "Sales Insight uses fixed windows shown in each widget title.";

export const SALES_RANGE_SHORT_LABELS: Record<"12m" | "30d" | "ytd", string> = {
  "12m": "12m",
  "30d": "30d",
  ytd: "YTD",
};

type PipelineCounts = { visited: number; enrolled: number };

function conversionRate(visited: number, enrolled: number): number | null {
  if (visited <= 0) return null;
  return Math.round((enrolled / visited) * 100);
}

export function salesPipelinePairCaption(
  allTime: PipelineCounts,
  last30d: PipelineCounts,
): string | undefined {
  const allRate = conversionRate(allTime.visited, allTime.enrolled);
  const recentRate = conversionRate(last30d.visited, last30d.enrolled);
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
