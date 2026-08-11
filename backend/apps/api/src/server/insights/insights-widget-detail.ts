import { AtlasHttpError } from "@atlas/core/http/errors";
import { computeDeltaAbs, computeDeltaPct, type InsightDashboardRange } from "./insights-range";
import type { InsightWidget, InsightWidgetDetail } from "./insights.schemas";

type DashboardLike = {
  slug: string;
  title: string;
  currency?: string | undefined;
  range?: InsightDashboardRange | undefined;
  generatedAt?: string | undefined;
  widgets: InsightWidget[];
};

type RelatedIcon = InsightWidgetDetail["related"][number]["icon"];

const MONEY_WIDGET_IDS = new Set([
  "monthly-revenue",
  "revenue",
  "revenue-30d",
  "top-products",
  "top-sources",
  "failed-payments",
]);

const AVERAGE_HEADLINE_WIDGET_IDS = new Set(["daily-active-users"]);

/** Sequential funnels and overlapping segments must not be summed into a headline. */
const NON_SUM_WIDGET_IDS = new Set([
  "pipeline",
  "pipeline-30d",
  "opportunity-pool",
  "engagement-funnel",
]);

const DESCRIPTIONS: Record<string, string> = {
  "monthly-revenue":
    "Monthly breakdown of all paid enrollments and trial conversions across all active products.",
  "monthly-enrollments": "Paid versus free enrollments, grouped by period.",
  "failed-payments": "Failed transactions requiring attention.",
  "top-products": "Highest-revenue products in this period.",
  "payment-orders": "Checkout attempts grouped by status.",
  pipeline: "Visited to enrolled, all time. Sequential stages, not independent event counts.",
  "pipeline-30d":
    "Visited to enrolled in the last 30 days. Sequential stages, not independent event counts.",
  "enrollment-channels": "Enrollment volume grouped by acquisition channel.",
  "top-sources": "Attribution sources by event count and attributed revenue.",
  "opportunity-pool":
    "Paid, trial, free, and offline enrollment segments. These overlap and do not sum.",
  "revenue-30d": "Recognized paid revenue in the last 30 days.",
  "paid-orders": "Successful payment orders on record.",
  "failed-orders": "Failed payment orders requiring attention. Higher is worse.",
  "paid-enrollments": "Paid enrollments on record.",
  "trial-free-pool": "Trial and free enrollments that have not converted to paid.",
  "conversion-rate": "Visited-to-enrolled conversion, all time.",
  "conversion-rate-30d": "Visited-to-enrolled conversion in the last 30 days.",
  "enrollments-30d": "New enrollments recorded in the last 30 days.",
  "paid-enrollments-30d": "Paid enrollments recorded in the last 30 days.",
  revenue: "Recognized paid revenue for the selected range.",
  enrollments: "New enrollments recorded in the selected range.",
  learners: "Active learner memberships in this academy.",
  products: "Published catalog items.",
  "current-mau": "Monthly active users in the current calendar month.",
  "active-users-30d": "Distinct active users in the last 30 days.",
  "learning-activity": "All learning events per day in the selected window.",
  "upcoming-live": "Sessions scheduled or currently live.",
  "pending-tasks": "Open ops items across reviews, moderation, and deletions.",
  "active-enrollments": "Open enrollments across published courses.",
  "inactive-learners": "Learners with no recorded activity for 30 days or more. Higher is worse.",
  "assessment-pass-rate": "Share of submitted assessments that passed in the selected window.",
  "lessons-completed": "Lesson completion events in the selected window.",
  "assessments-submitted": "Assessment submissions in the selected window.",
  "assessments-passed": "Assessments that passed in the selected window.",
  "practice-sessions": "Practice session completions in the selected window.",
  "certificates-issued": "Certificates issued in the selected window.",
  "community-posts": "Community posts created in the selected window.",
  "path-steps": "Learning path steps completed in the selected window.",
  "moderation-opened": "Moderation cases opened in the selected window. Higher is worse.",
  "lessons-trend": "Lesson completions per day in the selected window.",
  "assessments-trend": "Assessment submissions per day in the selected window.",
  "daily-active-users": "Unique learners with at least one session in the selected window.",
  "engagement-funnel":
    "Independent learning event counts in the selected window, not a single cohort.",
  "content-health":
    "Signals for dormant content, inactivity, moderation, and upcoming live sessions.",
  "top-courses": "Courses with the most lesson completions in the selected window.",
};

function numericCell(row: Record<string, string | number | null> | undefined, key: string): number {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringCell(
  row: Record<string, string | number | null> | undefined,
  key: string,
  fallback = "",
): string {
  const value = row?.[key];
  if (value == null) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function measureKeys(widget: InsightWidget): string[] {
  if (widget.data.measures && widget.data.measures.length > 0) {
    return widget.data.measures;
  }
  return widget.data.columns
    .filter((column) => column.kind === "measure" || column.kind === "number")
    .map((column) => column.key);
}

function primaryMeasureKey(widget: InsightWidget): string | null {
  return measureKeys(widget)[0] ?? null;
}

function sumMeasure(widget: InsightWidget, key: string): number {
  return widget.data.rows.reduce((sum, row) => sum + numericCell(row, key), 0);
}

function isMoneyWidget(widget: InsightWidget): boolean {
  return MONEY_WIDGET_IDS.has(widget.id) || /revenue|amount/i.test(widget.title);
}

function rangeLabels(range: InsightDashboardRange): { current: string; previous: string } {
  if (range === "30d") {
    return { current: "Current (30d)", previous: "Previous (30d)" };
  }
  if (range === "ytd") {
    return { current: "Year to date", previous: "Prior year to date" };
  }
  return { current: "Current (12m)", previous: "Previous (12m)" };
}

function groupByCount(
  widget: InsightWidget,
  dimensionKey: string,
): Array<{ label: string; value: number; share: number }> {
  const totals = new Map<string, number>();
  for (const row of widget.data.rows) {
    const label = stringCell(row, dimensionKey, "Unknown");
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([label, value]) => ({
    label,
    value,
    share: Math.round((value / total) * 1000) / 10,
  }));
}

function groupByDimension(
  widget: InsightWidget,
  dimensionKey: string,
  measureKey: string,
): Array<{ label: string; value: number; share: number }> {
  const totals = new Map<string, number>();
  for (const row of widget.data.rows) {
    const label = stringCell(row, dimensionKey, "Unknown");
    totals.set(label, (totals.get(label) ?? 0) + numericCell(row, measureKey));
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([label, value]) => ({
    label,
    value,
    share: Math.round((value / total) * 1000) / 10,
  }));
}

function splitOptionsFor(widget: InsightWidget): Array<{ id: string; label: string }> {
  const skip = new Set([
    "href",
    "period",
    "attempted",
    "scheduled",
    "starts",
    "value",
    "count",
    "signal",
    "consequence",
    "title",
    "tone",
    "stage",
    "label",
    "source",
    "segment",
    "learner",
  ]);
  const options: Array<{ id: string; label: string }> = [];
  for (const column of widget.data.columns) {
    if (skip.has(column.key)) continue;
    if (column.kind === "measure" || column.kind === "number" || column.kind === "date") continue;
    options.push({ id: column.key, label: column.label });
  }
  if (widget.id === "monthly-enrollments") {
    return [{ id: "enrollment-type", label: "Enrollment type" }];
  }
  return options;
}

function enrollmentTypeSplit(
  widget: InsightWidget,
): Array<{ label: string; value: number; share: number }> {
  const paid = sumMeasure(widget, "paid");
  const free = sumMeasure(widget, "free");
  const total = paid + free || 1;
  return [
    { label: "Paid", value: paid, share: Math.round((paid / total) * 1000) / 10 },
    { label: "Free", value: free, share: Math.round((free / total) * 1000) / 10 },
  ];
}

function relatedFor(widget: InsightWidget, slug: string): InsightWidgetDetail["related"] {
  const items: InsightWidgetDetail["related"] = [];
  const push = (title: string, description: string, href: string, icon: RelatedIcon) => {
    if (items.some((item) => item.href === href)) return;
    items.push({ title, description, href, icon });
  };

  if (widget.href && !widget.href.includes("/insights/")) {
    push("Open related report", "Full ledger for this widget.", widget.href, "receipt");
  }

  if (
    widget.id === "monthly-revenue" ||
    widget.id === "revenue" ||
    widget.id === "payment-orders"
  ) {
    push(
      "Payment detail report",
      "Granular view of individual transactions for reconciliation.",
      "/admin/reports/payments",
      "receipt",
    );
    if (slug !== "sales-insight") {
      push(
        "Sales insight",
        "Pipeline, paid versus free mix, and product revenue.",
        "/admin/insights/sales-insight",
        "forecast",
      );
    }
  }

  if (widget.id === "failed-payments") {
    push(
      "Gateway health",
      "Status mix and recovery paths for declined checkouts.",
      "/admin/reports/payments",
      "wallet",
    );
    push(
      "Payment transactions",
      "Retry patterns and individual failed attempts.",
      "/admin/reports/payments/transactions",
      "history",
    );
  }

  if (widget.id === "monthly-enrollments" || widget.id === "enrollments") {
    push(
      "Enrollment roster",
      "Learner-level enrollment records for this academy.",
      "/admin/reports/enrollments",
      "users",
    );
  }

  if (widget.id === "top-products" || widget.id === "products") {
    push(
      "Sales by product",
      "Revenue share across the published catalog.",
      "/admin/reports/sales-marketing",
      "payments",
    );
  }

  if (widget.id === "upcoming-live" || slug === "live-dashboard") {
    push("Live sessions", "Schedule, attendance, and session ops.", "/admin/live-sessions", "live");
  }

  if (slug === "marketing-insight") {
    push(
      "Marketing forms",
      "Lead capture and attribution sources.",
      "/admin/marketing/forms/contacts",
      "campaign",
    );
  }

  if (slug === "messenger-insight") {
    push(
      "Messenger inbox",
      "Channel delivery and failed sends.",
      "/admin/marketing/messenger/whatsapp/inbox",
      "inbox",
    );
  }

  if (slug === "sales-insight") {
    const widgetHref = (id: string) => `/admin/insights/sales-insight/widgets/${id}`;
    if (
      widget.id === "pipeline" ||
      widget.id === "pipeline-30d" ||
      widget.id.startsWith("conversion-rate")
    ) {
      push(
        "Sales pipeline comparison",
        "Visited, started diagnostic, and enrolled. All time against the last 30 days.",
        "/admin/insights/sales-insight/pipeline",
        "forecast",
      );
    }
    if (widget.id === "top-sources" || widget.id === "enrollment-channels") {
      push(
        "Attribution",
        "Which sources bring events, and what revenue is attributed to them.",
        "/admin/insights/sales-insight/attribution",
        "campaign",
      );
    }
    if (
      widget.id === "opportunity-pool" ||
      widget.id === "trial-free-pool" ||
      widget.id === "paid-enrollments"
    ) {
      push(
        "Conversion opportunity",
        "Who is enrolled but not paying, and how they got there.",
        "/admin/insights/sales-insight/opportunity",
        "users",
      );
    }
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "monthly-revenue": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Track potential revenue across stages before conversion.",
          "forecast",
        ],
        [
          "failed-payments",
          "Recent failed payments",
          "Monitor subscription churn and checkout drops.",
          "warning",
        ],
        [
          "top-products",
          "Top products by sales",
          "Volume and conversion rates for top-performing SKUs.",
          "payments",
        ],
      ],
      revenue: [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["revenue-30d", "Revenue (30d)", "Paid revenue in the last 30 days.", "forecast"],
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
      ],
      "revenue-30d": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["revenue", "Revenue (all time)", "Recognized paid revenue on record.", "forecast"],
      ],
      pipeline: [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "The same sequential funnel limited to the last 30 days.",
          "forecast",
        ],
        [
          "conversion-rate",
          "Conversion rate",
          "Visited-to-enrolled conversion, all time.",
          "forecast",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "payments",
        ],
      ],
      "pipeline-30d": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "The same sequential funnel across all recorded visits.",
          "forecast",
        ],
        [
          "conversion-rate-30d",
          "Conversion rate (30d)",
          "Visited-to-enrolled conversion in the last 30 days.",
          "forecast",
        ],
        [
          "enrollments-30d",
          "Enrollments (30d)",
          "New enrollments recorded in the last 30 days.",
          "users",
        ],
      ],
      "failed-payments": [
        [
          "payment-orders",
          "Orders by status",
          "Checkout attempts grouped by paid, failed, and other statuses.",
          "receipt",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        [
          "failed-orders",
          "Failed orders",
          "Count of failed payment orders. Higher is worse.",
          "warning",
        ],
      ],
      "failed-orders": [
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
        ["payment-orders", "Orders by status", "Checkout attempts grouped by status.", "receipt"],
      ],
      "top-products": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        ["products", "Products", "Published catalog items.", "payments"],
      ],
      "payment-orders": [
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
      ],
      "enrollment-channels": [
        [
          "top-sources",
          "Top attribution sources",
          "Campaign sources by events and attributed revenue.",
          "campaign",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
      "top-sources": [
        [
          "enrollment-channels",
          "Enrollments by channel",
          "Enrollment volume grouped by acquisition channel.",
          "campaign",
        ],
      ],
      "opportunity-pool": [
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
        ["paid-enrollments", "Paid enrollments", "Paid enrollments on record.", "users"],
      ],
      "conversion-rate": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
        [
          "conversion-rate-30d",
          "Conversion rate (30d)",
          "Visited-to-enrolled conversion in the last 30 days.",
          "forecast",
        ],
      ],
      "conversion-rate-30d": [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
        [
          "conversion-rate",
          "Conversion rate",
          "Visited-to-enrolled conversion, all time.",
          "forecast",
        ],
      ],
      "paid-orders": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["payment-orders", "Orders by status", "Checkout attempts grouped by status.", "receipt"],
      ],
      "paid-enrollments": [
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
      ],
      "paid-enrollments-30d": [
        [
          "enrollments-30d",
          "Enrollments (30d)",
          "New enrollments recorded in the last 30 days.",
          "users",
        ],
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
      ],
      "enrollments-30d": [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
        [
          "paid-enrollments-30d",
          "Paid enrollments (30d)",
          "Paid enrollments in the last 30 days.",
          "users",
        ],
      ],
      "trial-free-pool": [
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
      products: [
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
      ],
      learners: [
        ["paid-enrollments", "Paid enrollments", "Paid enrollments on record.", "users"],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      push(title, description, widgetHref(id), icon);
    }
    if (widget.id === "top-sources" || widget.id === "enrollment-channels") {
      push(
        "Marketing insight",
        "Lead capture, attribution, and campaign performance.",
        "/admin/insights/marketing-insight",
        "campaign",
      );
    }
  }

  if (slug === "school-vitals") {
    const widgetHref = (id: string) => `/admin/insights/school-vitals/widgets/${id}`;
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "daily-active-users": [
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
        ["current-mau", "Current MAU", "Active learners in the current calendar month.", "users"],
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
      ],
      "active-users-30d": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        ["current-mau", "Current MAU", "Active learners in the current calendar month.", "users"],
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
      ],
      "current-mau": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
      ],
      learners: [
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
        [
          "active-users-30d",
          "Active users (30d)",
          "Distinct learners active in the last 30 days.",
          "users",
        ],
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
      ],
      "inactive-learners": [
        ["learners", "Learners", "Active learner memberships in this academy.", "users"],
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "active-enrollments": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        ["learners", "Learners", "Active learner memberships in this academy.", "users"],
      ],
      "learning-activity": [
        [
          "lessons-trend",
          "Lessons completed",
          "Lesson completions per day in the selected window.",
          "history",
        ],
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "lessons-trend": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "assessments-trend": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "engagement-funnel": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "assessment-pass-rate": [
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "content-health": [
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
        [
          "moderation-opened",
          "Moderation cases opened",
          "Cases opened in the selected window. Higher is worse.",
          "warning",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "top-courses": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "moderation-opened": [
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "lessons-completed": [
        [
          "lessons-trend",
          "Lessons completed",
          "Lesson completions per day in the selected window.",
          "history",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "assessments-submitted": [
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "assessments-passed": [
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "practice-sessions": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
      ],
      "certificates-issued": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "community-posts": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "path-steps": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      const href =
        id === "engagement-funnel"
          ? "/admin/insights/school-vitals/funnel"
          : id === "content-health"
            ? "/admin/insights/school-vitals/content-health"
            : widgetHref(id);
      push(title, description, href, icon);
    }
  }

  return items.slice(0, 4);
}

function formatNoteValue(widget: InsightWidget, value: number, currency?: string): string {
  if (isMoneyWidget(widget)) {
    const amount = value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? `${amount} ${currency}` : amount;
  }
  return value.toLocaleString("en-US");
}

function formatNotePeriod(period: string): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period.slice(0, 7);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function seriesInsightNote(
  widget: InsightWidget,
  measureKey: string,
  currency?: string,
): string | null {
  if (widget.footnote) return widget.footnote;
  const rows = widget.data.rows;
  if (rows.length < 2) return null;
  const values = rows.map((row) => numericCell(row, measureKey));
  let peakIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[peakIndex] ?? 0)) peakIndex = index;
  }
  const peak = rows[peakIndex];
  if (!peak) return null;
  const trailing = values.slice(-3);
  const falling =
    trailing.length === 3 &&
    (trailing[0] ?? 0) > (trailing[1] ?? 0) &&
    (trailing[1] ?? 0) > (trailing[2] ?? 0);
  const periodLabel = formatNotePeriod(stringCell(peak, "period"));
  const peakLabel = formatNoteValue(widget, numericCell(peak, measureKey), currency);
  if (falling) {
    if (isMoneyWidget(widget)) {
      return `Revenue fell for two consecutive months after peaking at ${peakLabel} in ${periodLabel}.`;
    }
    return `Peaked at ${peakLabel} in ${periodLabel} and has fallen for two consecutive periods.`;
  }
  return `Peak period ${periodLabel} recorded ${peakLabel}.`;
}

function failureInsight(
  widget: InsightWidget,
  paymentOrders: InsightWidget | undefined,
): InsightWidgetDetail["failureRate"] {
  if (widget.id !== "failed-payments") return null;
  const reasonSplit = groupByCount(widget, "reason");
  const gatewaySplit = groupByCount(widget, "gateway");
  const topReason = reasonSplit[0];
  const topGateway = gatewaySplit[0];
  const noteParts: string[] = [];
  if (topReason) {
    noteParts.push(`Most common reason: ${topReason.label} (${String(topReason.share)}%).`);
  }
  if (topGateway) {
    noteParts.push(`Highest volume gateway: ${topGateway.label}.`);
  }

  let currentPct: number | null = null;
  if (paymentOrders) {
    const failed = paymentOrders.data.rows
      .filter((row) => stringCell(row, "label").toLowerCase() === "failed")
      .reduce((sum, row) => sum + numericCell(row, "value"), 0);
    const total = sumMeasure(paymentOrders, "value");
    if (total > 0) currentPct = Math.round((failed / total) * 1000) / 10;
  } else if (widget.data.rows.length > 0) {
    currentPct = 100;
  }

  if (currentPct == null) return null;
  return {
    currentPct,
    previousPct: null,
    deltaPct: null,
    note: noteParts.join(" ") || null,
  };
}

function aggregateMeasure(widget: InsightWidget, key: string): number {
  if (widget.defaultViz === "kpi") {
    return numericCell(widget.data.rows[0], "value");
  }
  if (AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id)) {
    const values = widget.data.rows.map((row) => numericCell(row, key));
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  if (NON_SUM_WIDGET_IDS.has(widget.id) || widget.defaultViz === "funnel") {
    return numericCell(widget.data.rows[widget.data.rows.length - 1], key);
  }
  return sumMeasure(widget, key);
}

function buildComparison(
  widget: InsightWidget,
  range: InsightDashboardRange,
): InsightWidgetDetail["comparison"] {
  if (NON_SUM_WIDGET_IDS.has(widget.id) || widget.defaultViz === "funnel") return null;
  const measureKey = primaryMeasureKey(widget);
  if (!measureKey) return null;
  const current = aggregateMeasure(widget, measureKey);
  const labels = rangeLabels(range);
  let previous: number | null = null;
  if (widget.deltaPct != null && widget.deltaPct !== -100) {
    previous = current / (1 + widget.deltaPct / 100);
  } else if (
    !AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id) &&
    widget.deltaAbs != null &&
    Number.isFinite(widget.deltaAbs)
  ) {
    previous = current - widget.deltaAbs;
  }
  if (previous == null || !Number.isFinite(previous)) return null;
  const roundedPrevious = Math.round(previous * 100) / 100;
  return {
    currentLabel: AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id)
      ? `Average (${labels.current})`
      : labels.current,
    previousLabel: labels.previous,
    current,
    previous: roundedPrevious,
    deltaAbs: computeDeltaAbs(current, roundedPrevious),
    deltaPct: widget.deltaPct ?? computeDeltaPct(current, roundedPrevious),
    unit: isMoneyWidget(widget) ? "money" : "count",
  };
}

function widgetNotFoundError(widgetId: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: `Insight widget not found: ${widgetId}`,
  });
}

export function buildInsightWidgetDetail(
  dashboard: DashboardLike,
  widgetId: string,
): InsightWidgetDetail {
  const widget = dashboard.widgets.find((item) => item.id === widgetId);
  if (!widget) throw widgetNotFoundError(widgetId);

  const range = dashboard.range ?? "12m";
  const measureKey = primaryMeasureKey(widget);
  const options = splitOptionsFor(widget);
  const splits: InsightWidgetDetail["splits"] = {};
  if (widget.id === "monthly-enrollments") {
    splits["enrollment-type"] = enrollmentTypeSplit(widget);
  } else if (widget.id === "failed-payments") {
    for (const option of options) {
      splits[option.id] = groupByCount(widget, option.id);
    }
  } else if (measureKey) {
    for (const option of options) {
      splits[option.id] = groupByDimension(widget, option.id, measureKey);
    }
  }

  const values =
    measureKey != null ? widget.data.rows.map((row) => numericCell(row, measureKey)) : [];
  const average =
    values.length > 0 && !NON_SUM_WIDGET_IDS.has(widget.id) && widget.defaultViz !== "funnel"
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;

  const paymentOrders = dashboard.widgets.find((item) => item.id === "payment-orders");

  return {
    slug: dashboard.slug,
    sectionTitle: dashboard.title,
    ...(dashboard.currency ? { currency: dashboard.currency } : {}),
    range,
    generatedAt: dashboard.generatedAt ?? new Date().toISOString(),
    widget,
    description: DESCRIPTIONS[widget.id] ?? widget.title,
    comparison: buildComparison(widget, range),
    average,
    insightNote: measureKey ? seriesInsightNote(widget, measureKey, dashboard.currency) : null,
    splitOptions: options,
    splits,
    related: relatedFor(widget, dashboard.slug),
    failureRate: failureInsight(widget, paymentOrders),
  };
}
