"use client";

import { clientApi } from "../../../lib/client-api";
import type { NormalizedResult, VizType } from "../../analytics/viz";

export type InsightDashboardRange = "12m" | "30d" | "ytd";

export type InsightWidget = {
  id: string;
  title: string;
  defaultViz: VizType;
  span: "full" | "half" | "third";
  data: NormalizedResult;
  deltaPct?: number | null;
  deltaAbs?: number | null;
  sparkline?: number[];
  href?: string | null;
  footnote?: string;
};

export type InsightAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href: string | null;
};

export type InsightLayoutDensity = "comfortable" | "compact";
export type InsightLayoutSharing = "private" | "tenant";

export type InsightLayoutWidget = {
  id: string;
  hidden: boolean;
  span: InsightWidget["span"];
  viz: VizType;
  order: number;
};

export type InsightLayout = {
  density: InsightLayoutDensity;
  sharing: InsightLayoutSharing;
  widgets: InsightLayoutWidget[];
};

export type InsightLayoutCatalogItem = {
  id: string;
  title: string;
  defaultViz: VizType;
  span: InsightWidget["span"];
  allowedViz?: VizType[];
};

export type InsightLayoutBoard = {
  slug: string;
  title: string;
  generatedAt: string;
  layout: InsightLayout;
  factory: InsightLayout;
  catalog: InsightLayoutCatalogItem[];
  summary: { widgets: number; hidden: number; kpis: number };
  copyTargets: Array<{ slug: string; title: string }>;
};

export type InsightLayoutMutation = {
  action: "save" | "reset" | "copy";
  layout?: InsightLayout;
  targetSlug?: string;
};

export type InsightDashboard = {
  slug: string;
  title: string;
  currency?: string;
  range?: InsightDashboardRange;
  generatedAt?: string;
  alerts: InsightAlert[];
  widgets: InsightWidget[];
  layout?: InsightLayout;
};

export async function fetchInsightDashboard(slug: string, range: InsightDashboardRange = "12m") {
  const params = new URLSearchParams({ range });
  return clientApi.get<{ data: InsightDashboard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}?${params.toString()}`,
  );
}

export type InsightWidgetRelatedIcon =
  | "receipt"
  | "payments"
  | "forecast"
  | "wallet"
  | "history"
  | "warning"
  | "users"
  | "live"
  | "campaign"
  | "inbox";

export type InsightWidgetSplitRow = {
  label: string;
  value: number;
  share: number;
};

export type InsightWidgetDetail = {
  slug: string;
  sectionTitle: string;
  currency?: string;
  range: InsightDashboardRange;
  generatedAt: string;
  widget: InsightWidget;
  description: string;
  comparison: {
    currentLabel: string;
    previousLabel: string;
    current: number;
    previous: number;
    deltaAbs: number;
    deltaPct: number | null;
    unit: "money" | "count";
  } | null;
  average: number | null;
  insightNote: string | null;
  splitOptions: Array<{ id: string; label: string }>;
  splits: Record<string, InsightWidgetSplitRow[]>;
  related: Array<{
    title: string;
    description: string;
    href: string;
    icon: InsightWidgetRelatedIcon;
  }>;
  failureRate: {
    currentPct: number;
    previousPct: number | null;
    deltaPct: number | null;
    note: string | null;
  } | null;
};

export async function fetchInsightWidgetDetail(
  slug: string,
  widgetId: string,
  range: InsightDashboardRange = "12m",
) {
  const params = new URLSearchParams({ range });
  return clientApi.get<{ data: InsightWidgetDetail }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/widgets/${encodeURIComponent(widgetId)}?${params.toString()}`,
  );
}

export type InsightEngagementFunnelStage = {
  key: string;
  label: string;
  widgetId: string;
  count: number;
  currentHalf: number | null;
  previousCount: number | null;
  sharePct: number;
  maxSharePct: number;
  deltaAbs: number | null;
  deltaPct: number | null;
  sparkline: number[];
};

export type InsightEngagementFunnelRatio = {
  id: string;
  label: string;
  detail: string;
  valuePct: number;
};

export type InsightEngagementFunnelBoard = {
  slug: "school-vitals";
  title: string;
  range: InsightDashboardRange;
  rangeLabel: string;
  currentLabel: string;
  previousLabel: string;
  generatedAt: string;
  from: string;
  to: string;
  caveat: string;
  totalEvents: number;
  empty: boolean;
  comparable: boolean;
  topMover: { label: string; deltaPct: number } | null;
  stages: InsightEngagementFunnelStage[];
  ratios: InsightEngagementFunnelRatio[];
  progressHref: string;
};

export async function fetchInsightEngagementFunnel(
  slug: string,
  range: InsightDashboardRange = "30d",
) {
  const params = new URLSearchParams({ range });
  return clientApi.get<{ data: InsightEngagementFunnelBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/funnel?${params.toString()}`,
  );
}

export type InsightSalesPipelineStageKey = "visited" | "started-diagnostic" | "enrolled";

export type InsightSalesPipelineWindow = {
  id: "all-time" | "30d";
  label: string;
  visited: number;
  startedDiagnostic: number;
  enrolled: number;
  conversionPct: number | null;
  conversionDisplay: string;
  empty: boolean;
};

export type InsightSalesPipelineStage = {
  key: InsightSalesPipelineStageKey;
  label: string;
  href: string;
  allTimeCount: number;
  recentCount: number;
  allTimeConvPct: number | null;
  recentConvPct: number | null;
  allTimeConvDisplay: string;
  recentConvDisplay: string;
  deltaPts: number | null;
  deltaDisplay: string;
};

export type InsightSalesPipelineDropoff = {
  id: string;
  fromKey: InsightSalesPipelineStageKey;
  toKey: InsightSalesPipelineStageKey;
  label: string;
  allTimeCount: number;
  allTimeRateDisplay: string;
  recentCount: number;
  recentRateDisplay: string;
};

export type InsightSalesPipelineBoard = {
  slug: "sales-insight";
  title: string;
  generatedAt: string;
  enrollmentsHref: string;
  settingsHref: string;
  caveat: string;
  empty: boolean;
  caption: string;
  leakCaption: string | null;
  conversionAllPct: number | null;
  conversionAllDisplay: string;
  conversion30dPct: number | null;
  conversion30dDisplay: string;
  differencePts: number | null;
  differenceDisplay: string;
  differenceTone: "up" | "down" | "flat" | "empty";
  visited30d: number;
  enrolled30d: number;
  allTime: InsightSalesPipelineWindow;
  recent: InsightSalesPipelineWindow;
  stages: InsightSalesPipelineStage[];
  dropoffs: InsightSalesPipelineDropoff[];
};

export async function fetchInsightSalesPipeline(slug: string) {
  return clientApi.get<{ data: InsightSalesPipelineBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/pipeline`,
  );
}

export type InsightSalesAttributionPattern = "high-volume low-value" | "low-volume high-value";

export type InsightSalesAttributionSource = {
  id: string;
  source: string;
  medium: string;
  label: string;
  events: number;
  revenueMajor: number;
  eventSharePct: number | null;
  revenueSharePct: number | null;
  revenuePerEvent: number | null;
  residual: number | null;
  href: string;
  pattern: InsightSalesAttributionPattern | null;
};

export type InsightSalesAttributionComposition = {
  id: string;
  label: string;
  kind: "source" | "other" | "unattributed";
  revenueMajor: number;
  sharePct: number | null;
};

export type InsightSalesAttributionBoard = {
  slug: "sales-insight";
  title: string;
  generatedAt: string;
  currency: string;
  reportHref: string;
  trackingHref: string;
  caveat: string;
  empty: boolean;
  caption: string;
  attributedRevenue: number;
  attributedSharePct: number | null;
  totalRevenue: number;
  unattributedRevenue: number;
  events: number;
  sourceCount: number;
  sourcesAbove1Pct: number;
  revenuePerEvent: number | null;
  maxEvents: number;
  maxRevenue: number;
  composition: InsightSalesAttributionComposition[];
  sources: InsightSalesAttributionSource[];
};

export async function fetchInsightSalesAttribution(slug: string) {
  return clientApi.get<{ data: InsightSalesAttributionBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/attribution`,
  );
}

export type InsightSalesOpportunityChip = {
  label: string;
  tone: "warning" | "success" | "neutral";
};

export type InsightSalesOpportunitySegment = {
  id: "paid" | "trial" | "free" | "offline" | "online";
  label: string;
  count: number;
  sharePct: number | null;
  tone: "success" | "warning" | "neutral" | "muted";
  collapsed: boolean;
  collapsedLabel: string | null;
  body: string;
  caption: string | null;
  chips: InsightSalesOpportunityChip[];
  primaryHref: string | null;
  primaryLabel: string | null;
  secondaryHref: string | null;
  secondaryLabel: string | null;
};

export type InsightSalesOpportunityMix = {
  id: string;
  label: string;
  count: number;
  sharePct: number | null;
  kind: "online" | "offline";
};

export type InsightSalesOpportunityBoard = {
  slug: "sales-insight";
  title: string;
  generatedAt: string;
  currency: string;
  enrollmentsHref: string;
  paymentsHref: string;
  messageHref: string;
  caveat: string;
  empty: boolean;
  allPaid: boolean;
  caption: string;
  pool: number;
  paid: number;
  trial: number;
  free: number;
  offline: number;
  online: number;
  exclusiveTotal: number;
  avgPaidMajor: number | null;
  paidProductCount: number;
  mixCaption: string;
  mix: InsightSalesOpportunityMix[];
  offlineMix: InsightSalesOpportunityMix;
  segments: InsightSalesOpportunitySegment[];
};

export async function fetchInsightSalesOpportunity(slug: string) {
  return clientApi.get<{ data: InsightSalesOpportunityBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/opportunity`,
  );
}

export type InsightContentHealthChipTone = "warning" | "danger" | "success" | "neutral";

export type InsightContentHealthChip = {
  label: string;
  tone: InsightContentHealthChipTone;
};

export type InsightContentHealthSignal = {
  id: "dormant-courses" | "inactive-learners" | "open-moderation" | "upcoming-live";
  label: string;
  count: number;
  tone: "warning" | "neutral" | "success";
  inverted: boolean;
  informational: boolean;
  consequence: string;
  chips: InsightContentHealthChip[];
  href: string;
  primaryLabel: string;
  secondaryHref: string | null;
  secondaryLabel: string | null;
};

export type InsightContentHealthSession = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  registeredCount: number;
  href: string;
};

export type InsightContentHealthBoard = {
  slug: "school-vitals";
  title: string;
  range: InsightDashboardRange;
  rangeLabel: string;
  generatedAt: string;
  from: string;
  to: string;
  caveat: string;
  windowNote: string;
  allClear: boolean;
  signals: InsightContentHealthSignal[];
  sessions: InsightContentHealthSession[];
  openedSeries: Array<{ period: string; value: number }>;
  openedSparkline: number[];
  progressHref: string;
};

export async function fetchInsightContentHealth(
  slug: string,
  range: InsightDashboardRange = "30d",
) {
  const params = new URLSearchParams({ range });
  return clientApi.get<{ data: InsightContentHealthBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/content-health?${params.toString()}`,
  );
}

export type InsightAlertItemStatus = "open" | "resolved" | "muted";

export type InsightAlertBoardItem = {
  id: string;
  ruleId: string;
  severity: InsightAlert["severity"];
  title: string;
  message: string;
  href: string | null;
  source: string;
  status: InsightAlertItemStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  seenAt: string | null;
  mutedUntil: string | null;
  resolvedAt: string | null;
  resolvedByLabel: string | null;
  durationSeconds: number | null;
  openedSeverity: InsightAlert["severity"] | null;
  peakSeverity: InsightAlert["severity"] | null;
};

export type InsightAlertRuleCard = {
  id: string;
  title: string;
  description: string;
  icon:
    | "payments"
    | "inbox"
    | "live"
    | "users"
    | "trend"
    | "moderation"
    | "course"
    | "campaign"
    | "message"
    | "activity"
    | "security";
  source: string;
  enabled: boolean;
  threshold: number;
  thresholdKind: "count" | "percent" | "none";
  min: number;
  max: number;
  lastFiredAt: string | null;
  health: "healthy" | "firing" | "disabled";
  severities: Array<"info" | "warning" | "critical">;
  currentValue: number;
  currentCaption: string | null;
};

export type InsightAlertsBoard = {
  slug: string;
  title: string;
  generatedAt: string;
  range: InsightDashboardRange;
  summary: {
    open: number;
    critical: number;
    warning: number;
    info: number;
    newSinceYesterday: number;
    resolvedThisWeek: number;
    muted: number;
  };
  alerts: InsightAlertBoardItem[];
  rules: InsightAlertRuleCard[];
};

export type InsightAlertsMutation = {
  action:
    | "mute"
    | "unmute"
    | "resolve"
    | "mark-seen"
    | "mark-all-seen"
    | "toggle-rule"
    | "set-threshold";
  ruleId?: string;
  muteFor?: "1d" | "7d" | "forever";
  enabled?: boolean;
  threshold?: number;
  range?: InsightDashboardRange;
};

export async function fetchInsightAlerts(slug: string, range: InsightDashboardRange = "12m") {
  const params = new URLSearchParams({ range });
  return clientApi.get<{ data: InsightAlertsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/alerts?${params.toString()}`,
  );
}

export async function mutateInsightAlerts(slug: string, body: InsightAlertsMutation) {
  return clientApi.patch<{ data: InsightAlertsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/alerts`,
    body,
    "insights-alerts",
  );
}

export async function fetchInsightLayout(slug: string) {
  return clientApi.get<{ data: InsightLayoutBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/layout`,
  );
}

export async function mutateInsightLayout(slug: string, body: InsightLayoutMutation) {
  return clientApi.patch<{ data: InsightLayoutBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/layout`,
    body,
    "insights-layout",
  );
}

export type InsightLibraryCategoryId =
  | "revenue"
  | "learners"
  | "learning"
  | "operations"
  | "live"
  | "sales"
  | "marketing"
  | "messenger";

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
  defaultViz: VizType;
  span: InsightWidget["span"];
  allowedViz: VizType[];
  onTarget: boolean;
  addable: boolean;
  dataSource: string;
  refreshCadence: string;
  preview: InsightLibraryPreview;
};

export type InsightLibraryBoard = {
  slug: string;
  title: string;
  targetSlug: string;
  targetTitle: string;
  generatedAt: string;
  range: InsightDashboardRange;
  currency?: string;
  sections: Array<{ slug: string; title: string }>;
  categories: Array<{ id: string; label: string }>;
  items: InsightLibraryItem[];
};

export type InsightLibraryMutation = {
  action: "add" | "remove";
  widgetIds: string[];
  targetSlug?: string;
  range?: InsightDashboardRange;
};

export async function fetchInsightLibrary(
  slug: string,
  range: InsightDashboardRange = "12m",
  target?: string,
) {
  const params = new URLSearchParams({ range });
  if (target) params.set("target", target);
  return clientApi.get<{ data: InsightLibraryBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/library?${params.toString()}`,
  );
}

export async function mutateInsightLibrary(slug: string, body: InsightLibraryMutation) {
  return clientApi.patch<{ data: InsightLibraryBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/library`,
    body,
    "insights-library",
  );
}

export type InsightDigestPeriod = InsightDashboardRange;
export type InsightDigestCadence = "daily" | "weekly" | "monthly";
export type InsightDigestFormat = "inline" | "inline-csv" | "link";
export type InsightDigestStatus = "delivered" | "failed" | "paused" | "scheduled";
export type InsightDigestHistoryCell = "delivered" | "failed" | "empty";

export type InsightDigestRecipient = {
  email: string;
  initials: string;
  outsideDomain: boolean;
};

export type InsightDigestItem = {
  id: string;
  name: string;
  sourceSlug: string;
  sourceTitle: string;
  enabled: boolean;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestPeriod;
  format: InsightDigestFormat;
  recipients: InsightDigestRecipient[];
  cadence: InsightDigestCadence;
  weekday: string;
  monthDay: number;
  time: string;
  timezone: string;
  createdAt: string;
  scheduleLabel: string;
  contentsLabel: string;
  status: InsightDigestStatus;
  lastError: string | null;
  nextSendAt: string | null;
  history: InsightDigestHistoryCell[];
  sends: Array<{ at: string; status: "delivered" | "failed"; error: string | null; test: boolean }>;
};

export type InsightDigestSummary = {
  total: number;
  enabled: number;
  paused: number;
  sendsThisMonth: number;
  deliveredThisMonth: number;
  recipients: number;
  outsideDomain: number;
  nextSendAt: string | null;
  nextSendName: string | null;
  failing: number;
};

export type InsightDigestPreview = {
  digestId: string;
  digestName: string;
  academyName: string;
  sectionTitle: string;
  periodLabel: string;
  format: InsightDigestFormat;
  liveHref: string;
  alerts: InsightAlert[];
  kpis: Array<{
    id: string;
    title: string;
    value: number;
    money: boolean;
    deltaPct?: number | null;
  }>;
  charts: Array<{ id: string; title: string; sparkline: number[] }>;
  currency?: string;
};

export type InsightDigestCatalogItem = {
  id: string;
  title: string;
  defaultViz: VizType;
};

export type InsightDigestsBoard = {
  slug: string;
  title: string;
  academyName: string;
  actorEmail: string | null;
  tenantDomains: string[];
  generatedAt: string;
  sections: Array<{ slug: string; title: string }>;
  timezones: string[];
  weekdays: Array<{ value: string; label: string }>;
  catalog: InsightDigestCatalogItem[];
  summary: InsightDigestSummary;
  digests: InsightDigestItem[];
  preview: InsightDigestPreview | null;
};

export type InsightDigestDraft = {
  name: string;
  sourceSlug: string;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestPeriod;
  format: InsightDigestFormat;
  recipients: string[];
  cadence: InsightDigestCadence;
  weekday: string;
  monthDay?: number | undefined;
  time: string;
  timezone: string;
};

export type InsightDigestsMutation = {
  action: "create" | "update" | "delete" | "toggle" | "send-test";
  id?: string;
  enabled?: boolean;
  digest?: InsightDigestDraft;
};

export async function fetchInsightDigests(slug: string, previewId?: string) {
  const params = new URLSearchParams();
  if (previewId) params.set("previewId", previewId);
  const query = params.toString();
  return clientApi.get<{ data: InsightDigestsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/digests${query ? `?${query}` : ""}`,
  );
}

export async function mutateInsightDigests(slug: string, body: InsightDigestsMutation) {
  return clientApi.patch<{ data: InsightDigestsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/digests`,
    body,
    "insights-digests",
  );
}

export type InsightNumberFormat = "international" | "european";
export type InsightWeekStart = "monday" | "sunday";
export type InsightDataClass = "personal" | "aggregated" | "financial";

export type InsightSettingsPatch = {
  defaultSection: string;
  defaultPeriod: InsightDashboardRange;
  weekStartsOn: InsightWeekStart;
  numberFormat: InsightNumberFormat;
  autoRefresh: boolean;
  refreshIntervalMinutes: 15 | 30 | 60;
  showLastUpdated: boolean;
  cacheMinutes: 5 | 15 | 30 | 60;
};

export type InsightSettingsAccessRow = {
  slug: string;
  title: string;
  href: string;
  restricted: boolean;
  visibleTo: Array<{ key: string; name: string; memberCount: number }>;
  dataClass: InsightDataClass;
  layoutSource: "tenant" | "factory";
};

export type InsightSettingsBoard = {
  slug: string;
  title: string;
  generatedAt: string;
  currency: string;
  numberFormatSample: string;
  settings: InsightSettingsPatch & { restrictedSlugs: string[] };
  sections: Array<{ slug: string; title: string }>;
  roles: Array<{ key: string; name: string; memberCount: number }>;
  access: InsightSettingsAccessRow[];
  activity: Array<{ at: string; action: string; actorLabel: string }>;
};

export type InsightSettingsMutation = {
  action: "save" | "restrict" | "unrestrict" | "reset-layout";
  settings?: InsightSettingsPatch | undefined;
  targetSlug?: string | undefined;
};

export async function fetchInsightSettings(slug: string) {
  return clientApi.get<{ data: InsightSettingsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/settings`,
  );
}

export async function mutateInsightSettings(slug: string, body: InsightSettingsMutation) {
  return clientApi.patch<{ data: InsightSettingsBoard }>(
    `/api/v1/insights/${encodeURIComponent(slug)}/settings`,
    body,
    "insights-settings",
  );
}
