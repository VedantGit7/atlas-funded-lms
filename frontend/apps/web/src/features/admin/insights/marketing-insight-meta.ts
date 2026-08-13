export const MARKETING_INSIGHT_ATTRIBUTION_KPI_IDS = [
  "attribution-events",
  "attribution-30d",
  "attribution-revenue",
  "contacts",
] as const;

export const MARKETING_INSIGHT_CAPTURE_KPI_IDS = [
  "contacts-30d",
  "form-submissions",
  "submissions-30d",
  "live-forms",
] as const;

export const MARKETING_INSIGHT_ENGAGEMENT_KPI_IDS = [
  "live-ctas",
  "cta-views",
  "cta-clicks",
  "cta-click-rate",
] as const;

export const MARKETING_INSIGHT_AUTOMATION_KPI_IDS = [
  "published-workflows",
  "workflow-runs-30d",
  "coupon-redemptions",
  "event-registrations",
] as const;

export const MARKETING_INSIGHT_MONEY_KPI_IDS = new Set(["attribution-revenue"]);

export const MARKETING_INSIGHT_PERCENT_KPI_IDS = new Set(["cta-click-rate"]);

export const MARKETING_CTA_EMPTY_CAPTION = "No CTA views recorded";

export const MARKETING_FIXED_WINDOW_CAPTION =
  "Marketing Insight uses fixed windows shown in each widget title.";

export const MARKETING_LIVE_COUNTS_CAPTION =
  "Live counts only published assets that can currently collect. The inventory widget shows both totals.";

export const MARKETING_ATTRIBUTION_PAIR_CAPTION =
  "The same events, split two ways. Totals match; the breakdowns do not add together.";

export const MARKETING_ATTRIBUTION_CAVEAT_SHORT =
  "Source, medium, and campaign are three dimensions over the same events. Totals match; breakdowns do not add together.";

export const MARKETING_DAILY_LEADS_CAPTION =
  "Submissions count form completions; contacts count people. One person can submit more than once.";

export const MARKETING_RANGE_SHORT_LABELS: Record<"12m" | "30d" | "ytd", string> = {
  "12m": "12m",
  "30d": "30d",
  ytd: "YTD",
};

/** Chart / table widgets in render order (after KPIs). */
export const MARKETING_INSIGHT_CHART_WIDGET_IDS = [
  "attribution-by-source",
  "attribution-by-medium",
  "daily-leads",
  "top-sources",
  "top-campaigns-utm",
  "top-forms",
  "top-ctas",
  "top-coupons",
  "marketing-inventory",
  "recent-workflow-runs",
] as const;

export const MARKETING_BAR_WIDGET_IDS = new Set(["attribution-by-source", "attribution-by-medium"]);

export const MARKETING_DUAL_SERIES_IDS = new Set(["daily-leads"]);

export const MARKETING_TABLE_WIDGET_IDS = new Set([
  "top-sources",
  "top-campaigns-utm",
  "top-forms",
  "top-ctas",
  "top-coupons",
  "marketing-inventory",
  "recent-workflow-runs",
]);

export type MarketingStatusTone = "success" | "danger" | "warning" | "neutral";

export function marketingStatusTone(raw: string): MarketingStatusTone {
  const value = raw.toLowerCase();
  if (
    value.includes("live") ||
    value.includes("published") ||
    value.includes("completed") ||
    value.includes("succeed") ||
    value.includes("active")
  ) {
    return "success";
  }
  if (value.includes("fail") || value.includes("error")) return "danger";
  if (value.includes("draft") || value.includes("paused") || value.includes("running")) {
    return "warning";
  }
  return "neutral";
}

export function marketingWidgetEmptyCopy(widgetId: string): { title: string; body: string } {
  switch (widgetId) {
    case "attribution-by-source":
    case "attribution-by-medium":
    case "top-sources":
    case "top-campaigns-utm":
      return {
        title: "No attribution events recorded",
        body: "When visitors convert with tracked UTMs, sources and campaigns appear here.",
      };
    case "daily-leads":
      return {
        title: "No lead activity in the last 30 days",
        body: "Form submissions and new contacts will plot here as capture picks up.",
      };
    case "top-forms":
      return {
        title: "No forms published yet",
        body: "Publish a live form to start collecting submissions.",
      };
    case "top-ctas":
      return {
        title: "No CTAs with engagement yet",
        body: "Live CTAs will show views and clicks once learners interact with them.",
      };
    case "top-coupons":
      return {
        title: "No coupon redemptions yet",
        body: "Redeemed codes and discount totals will list here after checkout uses them.",
      };
    case "marketing-inventory":
      return {
        title: "Marketing inventory is empty",
        body: "Forms, CTAs, workflows, and campaigns will count here as you publish them.",
      };
    case "recent-workflow-runs":
      return {
        title: "No workflow runs yet",
        body: "Automation runs appear here when published workflows fire.",
      };
    default:
      return {
        title: "Nothing to show yet",
        body: "This widget fills in as marketing activity lands.",
      };
  }
}
