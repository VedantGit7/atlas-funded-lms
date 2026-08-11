import { allowedVizFor, type InsightVizType, type InsightWidgetSpan } from "./insights-layout";

export const INSIGHT_LIBRARY_CATEGORIES = [
  { id: "revenue", label: "Revenue" },
  { id: "learners", label: "Learners" },
  { id: "learning", label: "Learning activity" },
  { id: "operations", label: "Operations" },
  { id: "live", label: "Live" },
  { id: "sales", label: "Sales" },
  { id: "marketing", label: "Marketing" },
  { id: "messenger", label: "Messenger" },
] as const;

export type InsightLibraryCategoryId = (typeof INSIGHT_LIBRARY_CATEGORIES)[number]["id"];

export type InsightLibraryPreview = {
  kind: "kpi" | "series" | "table" | "funnel" | "other";
  value?: number;
  money?: boolean;
  deltaPct?: number | null;
  sparkline?: number[];
  rowCount?: number;
};

export type InsightLibraryItem = {
  key: string;
  id: string;
  sourceSlug: string;
  sourceTitle: string;
  title: string;
  description: string;
  category: InsightLibraryCategoryId;
  categoryLabel: string;
  defaultViz: InsightVizType;
  span: InsightWidgetSpan;
  allowedViz: InsightVizType[];
  onTarget: boolean;
  addable: boolean;
  dataSource: string;
  refreshCadence: string;
  preview: InsightLibraryPreview;
};

type WidgetLike = {
  id: string;
  title: string;
  defaultViz: InsightVizType;
  span: InsightWidgetSpan;
  deltaPct?: number | null | undefined;
  sparkline?: number[] | undefined;
  data: {
    measures?: string[] | undefined;
    columns: Array<{ key: string; kind: string }>;
    rows: Array<Record<string, string | number | null>>;
  };
};

const CATEGORY_BY_ID: Record<string, InsightLibraryCategoryId> = {
  revenue: "revenue",
  "monthly-revenue": "revenue",
  "top-products": "revenue",
  "payment-orders": "revenue",
  "failed-payments": "revenue",
  pipeline: "sales",
  "pipeline-30d": "sales",
  "opportunity-pool": "sales",
  "enrollment-channels": "sales",
  products: "learners",
  learners: "learners",
  "current-mau": "learners",
  "active-users-30d": "learners",
  enrollments: "learners",
  "monthly-enrollments": "learners",
  "daily-active-users": "learners",
  "lessons-completed": "learning",
  "assessments-submitted": "learning",
  "assessments-passed": "learning",
  "practice-sessions": "learning",
  "certificates-issued": "learning",
  "community-posts": "learning",
  "path-steps": "learning",
  "learning-activity": "learning",
  "lessons-trend": "learning",
  "assessments-trend": "learning",
  "engagement-funnel": "learning",
  "content-health": "learning",
  "top-courses": "learning",
  "pending-tasks": "operations",
  "moderation-opened": "operations",
  "scheduled-events": "operations",
  "upcoming-live": "live",
  "sessions-by-status": "live",
  "attended-by-status": "live",
  "daily-attendance": "live",
  "upcoming-sessions": "live",
  "recent-sessions": "live",
  "low-attendance-sessions": "live",
  "attribution-by-source": "marketing",
  "attribution-by-medium": "marketing",
  "daily-leads": "marketing",
  "top-sources": "marketing",
  "top-campaigns-utm": "marketing",
  "top-forms": "marketing",
  "top-ctas": "marketing",
  "top-coupons": "marketing",
  "marketing-inventory": "marketing",
  "recent-workflow-runs": "marketing",
  "channel-mix-sends": "messenger",
  "channel-mix-reach": "messenger",
  "daily-volume": "messenger",
  "recent-email": "messenger",
  "recent-push": "messenger",
  "recent-whatsapp": "messenger",
  "recent-announcements": "messenger",
};

const DESCRIPTIONS: Record<string, string> = {
  "monthly-revenue": "Paid payment orders grouped by period, for the selected range.",
  "monthly-enrollments": "Paid versus free enrollments grouped by period.",
  "failed-payments": "Failed checkout attempts that still need attention.",
  "top-products": "Highest-revenue products in this period.",
  "payment-orders": "Checkout attempts grouped by status.",
  revenue: "Recognized paid revenue for the selected range.",
  enrollments: "New enrollments recorded in the selected range.",
  learners: "Active learner memberships.",
  products: "Published catalog items.",
  "current-mau": "Monthly active users in the current calendar month.",
  "active-users-30d": "Distinct active users in the last 30 days.",
  "learning-activity": "Learning events recorded over time.",
  "upcoming-live": "Sessions scheduled or currently live.",
  "pending-tasks": "Open ops items across reviews, moderation, and deletions.",
  pipeline: "Open revenue still sitting in the sales pipeline.",
  "daily-leads": "Inbound leads captured per day.",
  "daily-attendance": "Live session attendance over time.",
  "channel-mix-sends": "Outbound volume by messenger channel.",
};

const DATA_SOURCE_BY_CATEGORY: Record<InsightLibraryCategoryId, string> = {
  revenue: "Payment orders",
  learners: "Memberships",
  learning: "Learning events",
  operations: "Ops queues",
  live: "Live sessions",
  sales: "Sales pipeline",
  marketing: "Attribution",
  messenger: "Message sends",
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

function measureKey(widget: WidgetLike): string | null {
  if (widget.data.measures && widget.data.measures.length > 0) {
    return widget.data.measures[0] ?? null;
  }
  const column = widget.data.columns.find(
    (item) => item.kind === "measure" || item.kind === "number",
  );
  return column?.key ?? null;
}

export function categorizeLibraryWidget(id: string): InsightLibraryCategoryId {
  const mapped = CATEGORY_BY_ID[id];
  if (mapped) return mapped;
  if (id.includes("revenue") || id.includes("payment") || id.includes("pipeline")) return "revenue";
  if (id.includes("live") || id.includes("session") || id.includes("attend")) return "live";
  if (
    id.includes("lead") ||
    id.includes("utm") ||
    id.includes("campaign") ||
    id.includes("coupon")
  ) {
    return "marketing";
  }
  if (
    id.includes("email") ||
    id.includes("push") ||
    id.includes("whatsapp") ||
    id.includes("announce")
  ) {
    return "messenger";
  }
  if (
    id.includes("lesson") ||
    id.includes("assessment") ||
    id.includes("funnel") ||
    id.includes("course")
  ) {
    return "learning";
  }
  return "operations";
}

export function describeLibraryWidget(id: string, title: string): string {
  return DESCRIPTIONS[id] ?? `${title} for this insight section.`;
}

export function libraryCategoryLabel(id: InsightLibraryCategoryId): string {
  return INSIGHT_LIBRARY_CATEGORIES.find((row) => row.id === id)?.label ?? id;
}

export function buildLibraryPreview(widget: WidgetLike): InsightLibraryPreview {
  const key = measureKey(widget);
  const money = /revenue|amount|pipeline/i.test(`${widget.id} ${widget.title}`);
  if (widget.defaultViz === "kpi") {
    const value = key ? numericCell(widget.data.rows[0], key) : 0;
    return {
      kind: "kpi",
      value,
      money,
      deltaPct: widget.deltaPct ?? null,
      sparkline: widget.sparkline ?? [],
    };
  }
  if (widget.defaultViz === "funnel") {
    const sparkline = key ? widget.data.rows.slice(0, 8).map((row) => numericCell(row, key)) : [];
    return { kind: "funnel", sparkline };
  }
  if (
    widget.defaultViz === "line" ||
    widget.defaultViz === "area" ||
    widget.defaultViz === "bar" ||
    widget.defaultViz === "sparkline" ||
    widget.defaultViz === "combo"
  ) {
    const sparkline = key
      ? widget.data.rows.slice(0, 12).map((row) => numericCell(row, key))
      : (widget.sparkline ?? []);
    return { kind: "series", sparkline, money };
  }
  if (widget.defaultViz === "table" || widget.defaultViz === "pivot") {
    return { kind: "table", rowCount: widget.data.rows.length };
  }
  return { kind: "other" };
}

export function buildLibraryItem(args: {
  widget: WidgetLike;
  sourceSlug: string;
  sourceTitle: string;
  targetHasWidget: boolean;
  onTarget: boolean;
}): InsightLibraryItem {
  const category = categorizeLibraryWidget(args.widget.id);
  return {
    key: `${args.sourceSlug}:${args.widget.id}`,
    id: args.widget.id,
    sourceSlug: args.sourceSlug,
    sourceTitle: args.sourceTitle,
    title: args.widget.title,
    description: describeLibraryWidget(args.widget.id, args.widget.title),
    category,
    categoryLabel: libraryCategoryLabel(category),
    defaultViz: args.widget.defaultViz,
    span: args.widget.span,
    allowedViz: allowedVizFor(args.widget.defaultViz),
    onTarget: args.onTarget,
    addable: args.targetHasWidget,
    dataSource: DATA_SOURCE_BY_CATEGORY[category],
    refreshCadence: "On request",
    preview: buildLibraryPreview(args.widget),
  };
}

export function filterLibraryItems(
  items: InsightLibraryItem[],
  filters: {
    query?: string;
    section?: string;
    category?: string;
    viz?: string;
    onDashboard?: "all" | "only" | "hide";
  },
): InsightLibraryItem[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (query) {
      const haystack = `${item.title} ${item.description} ${item.categoryLabel}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.section && item.sourceSlug !== filters.section) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.viz && item.defaultViz !== filters.viz) return false;
    if (filters.onDashboard === "only" && !item.onTarget) return false;
    if (filters.onDashboard === "hide" && item.onTarget) return false;
    return true;
  });
}
