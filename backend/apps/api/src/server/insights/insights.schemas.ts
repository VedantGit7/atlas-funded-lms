import { z } from "zod";
import { normalizedResultSchema } from "../reports/reports.schemas";

export const insightDashboardRangeSchema = z.enum(["12m", "30d", "ytd"]).default("12m");

export const insightDashboardQuerySchema = z.object({
  range: insightDashboardRangeSchema,
});

export const insightWidgetSchema = z.object({
  id: z.string(),
  title: z.string(),
  defaultViz: z.enum([
    "kpi",
    "table",
    "pivot",
    "line",
    "area",
    "bar",
    "combo",
    "pie",
    "donut",
    "funnel",
    "progress",
    "scatter",
    "heatmap",
    "sparkline",
  ]),
  span: z.enum(["full", "half", "third"]).default("half"),
  data: normalizedResultSchema,
  deltaPct: z.number().nullable().optional(),
  deltaAbs: z.number().nullable().optional(),
  sparkline: z.array(z.number()).optional(),
  href: z.string().nullable().optional(),
  footnote: z.string().optional(),
});

export const insightVizTypeSchema = insightWidgetSchema.shape.defaultViz;
export const insightWidgetSpanSchema = insightWidgetSchema.shape.span;

export const insightLayoutWidgetSchema = z.object({
  id: z.string().min(1),
  hidden: z.boolean(),
  span: insightWidgetSpanSchema,
  viz: insightVizTypeSchema,
  order: z.number().int(),
});

export const insightLayoutSchema = z.object({
  density: z.enum(["comfortable", "compact"]),
  sharing: z.enum(["private", "tenant"]),
  widgets: z.array(insightLayoutWidgetSchema),
});

export const insightAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  message: z.string(),
  href: z.string().nullable(),
});

export const insightDashboardResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    currency: z.string().optional(),
    range: insightDashboardRangeSchema.optional(),
    generatedAt: z.string().optional(),
    alerts: z.array(insightAlertSchema).default([]),
    widgets: z.array(insightWidgetSchema),
    layout: insightLayoutSchema.optional(),
  }),
});

export const insightWidgetSplitRowSchema = z.object({
  label: z.string(),
  value: z.number(),
  share: z.number(),
});

export const insightWidgetRelatedSchema = z.object({
  title: z.string(),
  description: z.string(),
  href: z.string(),
  icon: z.enum([
    "receipt",
    "payments",
    "forecast",
    "wallet",
    "history",
    "warning",
    "users",
    "live",
    "campaign",
    "inbox",
  ]),
});

export const insightWidgetComparisonSchema = z.object({
  currentLabel: z.string(),
  previousLabel: z.string(),
  current: z.number(),
  previous: z.number(),
  deltaAbs: z.number(),
  deltaPct: z.number().nullable(),
  unit: z.enum(["money", "count"]),
});

export const insightWidgetFailureRateSchema = z.object({
  currentPct: z.number(),
  previousPct: z.number().nullable(),
  deltaPct: z.number().nullable(),
  note: z.string().nullable(),
});

export const insightWidgetDetailResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    sectionTitle: z.string(),
    currency: z.string().optional(),
    range: insightDashboardRangeSchema,
    generatedAt: z.string(),
    widget: insightWidgetSchema,
    description: z.string(),
    comparison: insightWidgetComparisonSchema.nullable(),
    average: z.number().nullable(),
    insightNote: z.string().nullable(),
    splitOptions: z.array(z.object({ id: z.string(), label: z.string() })),
    splits: z.record(z.string(), z.array(insightWidgetSplitRowSchema)),
    related: z.array(insightWidgetRelatedSchema),
    failureRate: insightWidgetFailureRateSchema.nullable(),
  }),
});

export const insightEngagementFunnelStageSchema = z.object({
  key: z.string(),
  label: z.string(),
  widgetId: z.string(),
  count: z.number(),
  currentHalf: z.number().nullable(),
  previousCount: z.number().nullable(),
  sharePct: z.number(),
  maxSharePct: z.number(),
  deltaAbs: z.number().nullable(),
  deltaPct: z.number().nullable(),
  sparkline: z.array(z.number()),
});

export const insightEngagementFunnelRatioSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  valuePct: z.number(),
});

export const insightEngagementFunnelResponseSchema = z.object({
  data: z.object({
    slug: z.literal("school-vitals"),
    title: z.string(),
    range: insightDashboardRangeSchema,
    rangeLabel: z.string(),
    currentLabel: z.string(),
    previousLabel: z.string(),
    generatedAt: z.string(),
    from: z.string(),
    to: z.string(),
    caveat: z.string(),
    totalEvents: z.number(),
    empty: z.boolean(),
    comparable: z.boolean(),
    topMover: z.object({ label: z.string(), deltaPct: z.number() }).nullable(),
    stages: z.array(insightEngagementFunnelStageSchema),
    ratios: z.array(insightEngagementFunnelRatioSchema),
    progressHref: z.string(),
  }),
});

export const insightSalesPipelineStageKeySchema = z.enum([
  "visited",
  "started-diagnostic",
  "enrolled",
]);

export const insightSalesPipelineWindowSchema = z.object({
  id: z.enum(["all-time", "30d"]),
  label: z.string(),
  visited: z.number(),
  startedDiagnostic: z.number(),
  enrolled: z.number(),
  conversionPct: z.number().nullable(),
  conversionDisplay: z.string(),
  empty: z.boolean(),
});

export const insightSalesPipelineStageSchema = z.object({
  key: insightSalesPipelineStageKeySchema,
  label: z.string(),
  href: z.string(),
  allTimeCount: z.number(),
  recentCount: z.number(),
  allTimeConvPct: z.number().nullable(),
  recentConvPct: z.number().nullable(),
  allTimeConvDisplay: z.string(),
  recentConvDisplay: z.string(),
  deltaPts: z.number().nullable(),
  deltaDisplay: z.string(),
});

export const insightSalesPipelineDropoffSchema = z.object({
  id: z.string(),
  fromKey: insightSalesPipelineStageKeySchema,
  toKey: insightSalesPipelineStageKeySchema,
  label: z.string(),
  allTimeCount: z.number(),
  allTimeRateDisplay: z.string(),
  recentCount: z.number(),
  recentRateDisplay: z.string(),
});

export const insightSalesPipelineResponseSchema = z.object({
  data: z.object({
    slug: z.literal("sales-insight"),
    title: z.string(),
    generatedAt: z.string(),
    enrollmentsHref: z.string(),
    settingsHref: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    caption: z.string(),
    leakCaption: z.string().nullable(),
    conversionAllPct: z.number().nullable(),
    conversionAllDisplay: z.string(),
    conversion30dPct: z.number().nullable(),
    conversion30dDisplay: z.string(),
    differencePts: z.number().nullable(),
    differenceDisplay: z.string(),
    differenceTone: z.enum(["up", "down", "flat", "empty"]),
    visited30d: z.number(),
    enrolled30d: z.number(),
    allTime: insightSalesPipelineWindowSchema,
    recent: insightSalesPipelineWindowSchema,
    stages: z.array(insightSalesPipelineStageSchema),
    dropoffs: z.array(insightSalesPipelineDropoffSchema),
  }),
});

export const insightSalesAttributionPatternSchema = z.enum([
  "high-volume low-value",
  "low-volume high-value",
]);

export const insightSalesAttributionSourceSchema = z.object({
  id: z.string(),
  source: z.string(),
  medium: z.string(),
  label: z.string(),
  events: z.number(),
  revenueMajor: z.number(),
  eventSharePct: z.number().nullable(),
  revenueSharePct: z.number().nullable(),
  revenuePerEvent: z.number().nullable(),
  residual: z.number().nullable(),
  href: z.string(),
  pattern: insightSalesAttributionPatternSchema.nullable(),
});

export const insightSalesAttributionCompositionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["source", "other", "unattributed"]),
  revenueMajor: z.number(),
  sharePct: z.number().nullable(),
});

export const insightSalesAttributionResponseSchema = z.object({
  data: z.object({
    slug: z.literal("sales-insight"),
    title: z.string(),
    generatedAt: z.string(),
    currency: z.string(),
    reportHref: z.string(),
    trackingHref: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    caption: z.string(),
    attributedRevenue: z.number(),
    attributedSharePct: z.number().nullable(),
    totalRevenue: z.number(),
    unattributedRevenue: z.number(),
    events: z.number(),
    sourceCount: z.number(),
    sourcesAbove1Pct: z.number(),
    revenuePerEvent: z.number().nullable(),
    maxEvents: z.number(),
    maxRevenue: z.number(),
    composition: z.array(insightSalesAttributionCompositionSchema),
    sources: z.array(insightSalesAttributionSourceSchema),
  }),
});

export const insightSalesOpportunityChipSchema = z.object({
  label: z.string(),
  tone: z.enum(["warning", "success", "neutral"]),
});

export const insightSalesOpportunitySegmentSchema = z.object({
  id: z.enum(["paid", "trial", "free", "offline", "online"]),
  label: z.string(),
  count: z.number(),
  sharePct: z.number().nullable(),
  tone: z.enum(["success", "warning", "neutral", "muted"]),
  collapsed: z.boolean(),
  collapsedLabel: z.string().nullable(),
  body: z.string(),
  caption: z.string().nullable(),
  chips: z.array(insightSalesOpportunityChipSchema),
  primaryHref: z.string().nullable(),
  primaryLabel: z.string().nullable(),
  secondaryHref: z.string().nullable(),
  secondaryLabel: z.string().nullable(),
});

export const insightSalesOpportunityMixSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
  sharePct: z.number().nullable(),
  kind: z.enum(["online", "offline"]),
});

export const insightSalesOpportunityResponseSchema = z.object({
  data: z.object({
    slug: z.literal("sales-insight"),
    title: z.string(),
    generatedAt: z.string(),
    currency: z.string(),
    enrollmentsHref: z.string(),
    paymentsHref: z.string(),
    messageHref: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    allPaid: z.boolean(),
    caption: z.string(),
    pool: z.number(),
    paid: z.number(),
    trial: z.number(),
    free: z.number(),
    offline: z.number(),
    online: z.number(),
    exclusiveTotal: z.number(),
    avgPaidMajor: z.number().nullable(),
    paidProductCount: z.number(),
    mixCaption: z.string(),
    mix: z.array(insightSalesOpportunityMixSchema),
    offlineMix: insightSalesOpportunityMixSchema,
    segments: z.array(insightSalesOpportunitySegmentSchema),
  }),
});

export const insightContentHealthChipSchema = z.object({
  label: z.string(),
  tone: z.enum(["warning", "danger", "success", "neutral"]),
});

export const insightContentHealthSignalSchema = z.object({
  id: z.enum(["dormant-courses", "inactive-learners", "open-moderation", "upcoming-live"]),
  label: z.string(),
  count: z.number(),
  tone: z.enum(["warning", "neutral", "success"]),
  inverted: z.boolean(),
  informational: z.boolean(),
  consequence: z.string(),
  chips: z.array(insightContentHealthChipSchema),
  href: z.string(),
  primaryLabel: z.string(),
  secondaryHref: z.string().nullable(),
  secondaryLabel: z.string().nullable(),
});

export const insightContentHealthSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  registeredCount: z.number(),
  href: z.string(),
});

export const insightContentHealthResponseSchema = z.object({
  data: z.object({
    slug: z.literal("school-vitals"),
    title: z.string(),
    range: insightDashboardRangeSchema,
    rangeLabel: z.string(),
    generatedAt: z.string(),
    from: z.string(),
    to: z.string(),
    caveat: z.string(),
    windowNote: z.string(),
    allClear: z.boolean(),
    signals: z.array(insightContentHealthSignalSchema),
    sessions: z.array(insightContentHealthSessionSchema),
    openedSeries: z.array(z.object({ period: z.string(), value: z.number() })),
    openedSparkline: z.array(z.number()),
    progressHref: z.string(),
  }),
});

export const insightAlertMuteForSchema = z.enum(["1d", "7d", "forever"]);

export const insightAlertItemSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  message: z.string(),
  href: z.string().nullable(),
  source: z.string(),
  status: z.enum(["open", "resolved", "muted"]),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  seenAt: z.string().nullable(),
  mutedUntil: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolvedByLabel: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  openedSeverity: z.enum(["info", "warning", "critical"]).nullable(),
  peakSeverity: z.enum(["info", "warning", "critical"]).nullable(),
});

export const insightAlertRuleCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.enum([
    "payments",
    "inbox",
    "live",
    "users",
    "trend",
    "moderation",
    "course",
    "campaign",
    "message",
    "activity",
    "security",
  ]),
  source: z.string(),
  enabled: z.boolean(),
  threshold: z.number(),
  thresholdKind: z.enum(["count", "percent", "none"]),
  min: z.number(),
  max: z.number(),
  lastFiredAt: z.string().nullable(),
  health: z.enum(["healthy", "firing", "disabled"]),
  severities: z.array(z.enum(["info", "warning", "critical"])),
  currentValue: z.number(),
  currentCaption: z.string().nullable(),
});

export const insightAlertSummarySchema = z.object({
  open: z.number(),
  critical: z.number(),
  warning: z.number(),
  info: z.number(),
  newSinceYesterday: z.number(),
  resolvedThisWeek: z.number(),
  muted: z.number(),
});

export const insightAlertsResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    generatedAt: z.string(),
    range: insightDashboardRangeSchema,
    summary: insightAlertSummarySchema,
    alerts: z.array(insightAlertItemSchema),
    rules: z.array(insightAlertRuleCardSchema),
  }),
});

export const insightAlertsMutationBodySchema = z.object({
  action: z.enum([
    "mute",
    "unmute",
    "resolve",
    "mark-seen",
    "mark-all-seen",
    "toggle-rule",
    "set-threshold",
  ]),
  ruleId: z.string().min(1).optional(),
  muteFor: insightAlertMuteForSchema.optional(),
  enabled: z.boolean().optional(),
  threshold: z.number().optional(),
  range: insightDashboardRangeSchema.optional(),
});

export const insightLayoutCatalogItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  defaultViz: insightVizTypeSchema,
  span: insightWidgetSpanSchema,
  allowedViz: z.array(insightVizTypeSchema).optional(),
});

export const insightLayoutResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    generatedAt: z.string(),
    layout: insightLayoutSchema,
    factory: insightLayoutSchema,
    catalog: z.array(insightLayoutCatalogItemSchema),
    summary: z.object({
      widgets: z.number(),
      hidden: z.number(),
      kpis: z.number(),
    }),
    copyTargets: z.array(
      z.object({
        slug: z.string(),
        title: z.string(),
      }),
    ),
  }),
});

export const insightLayoutMutationBodySchema = z.object({
  action: z.enum(["save", "reset", "copy"]),
  layout: insightLayoutSchema.optional(),
  targetSlug: z.string().min(1).optional(),
});

export const insightLibraryQuerySchema = z.object({
  range: insightDashboardRangeSchema,
  target: z.string().min(1).optional(),
});

export const insightLibraryPreviewSchema = z.object({
  kind: z.enum(["kpi", "series", "table", "funnel", "other"]),
  value: z.number().optional(),
  money: z.boolean().optional(),
  deltaPct: z.number().nullable().optional(),
  sparkline: z.array(z.number()).optional(),
  rowCount: z.number().optional(),
});

export const insightLibraryItemSchema = z.object({
  key: z.string(),
  id: z.string(),
  sourceSlug: z.string(),
  sourceTitle: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum([
    "revenue",
    "learners",
    "learning",
    "operations",
    "live",
    "sales",
    "marketing",
    "messenger",
  ]),
  categoryLabel: z.string(),
  defaultViz: insightVizTypeSchema,
  span: insightWidgetSpanSchema,
  allowedViz: z.array(insightVizTypeSchema),
  onTarget: z.boolean(),
  addable: z.boolean(),
  dataSource: z.string(),
  refreshCadence: z.string(),
  preview: insightLibraryPreviewSchema,
});

export const insightLibraryResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    targetSlug: z.string(),
    targetTitle: z.string(),
    generatedAt: z.string(),
    range: insightDashboardRangeSchema,
    currency: z.string().optional(),
    sections: z.array(z.object({ slug: z.string(), title: z.string() })),
    categories: z.array(z.object({ id: z.string(), label: z.string() })),
    items: z.array(insightLibraryItemSchema),
  }),
});

export const insightLibraryMutationBodySchema = z.object({
  action: z.enum(["add", "remove"]),
  widgetIds: z.array(z.string().min(1)).min(1),
  targetSlug: z.string().min(1).optional(),
  range: insightDashboardRangeSchema.optional(),
});

export const insightDigestCadenceSchema = z.enum(["daily", "weekly", "monthly"]);
export const insightDigestFormatSchema = z.enum(["inline", "inline-csv", "link"]);
export const insightDigestPeriodSchema = z.enum(["30d", "ytd", "12m"]);

export const insightDigestRecipientSchema = z.object({
  email: z.string(),
  initials: z.string(),
  outsideDomain: z.boolean(),
});

export const insightDigestSendSchema = z.object({
  at: z.string(),
  status: z.enum(["delivered", "failed"]),
  error: z.string().nullable(),
  test: z.boolean(),
});

export const insightDigestItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceSlug: z.string(),
  sourceTitle: z.string(),
  enabled: z.boolean(),
  includeAlerts: z.boolean(),
  includeKpis: z.boolean(),
  widgetIds: z.array(z.string()),
  period: insightDigestPeriodSchema,
  format: insightDigestFormatSchema,
  recipients: z.array(insightDigestRecipientSchema),
  cadence: insightDigestCadenceSchema,
  weekday: z.string(),
  monthDay: z.number().int(),
  time: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
  scheduleLabel: z.string(),
  contentsLabel: z.string(),
  status: z.enum(["delivered", "failed", "paused", "scheduled"]),
  lastError: z.string().nullable(),
  nextSendAt: z.string().nullable(),
  history: z.array(z.enum(["delivered", "failed", "empty"])),
  sends: z.array(insightDigestSendSchema),
});

export const insightDigestSummarySchema = z.object({
  total: z.number(),
  enabled: z.number(),
  paused: z.number(),
  sendsThisMonth: z.number(),
  deliveredThisMonth: z.number(),
  recipients: z.number(),
  outsideDomain: z.number(),
  nextSendAt: z.string().nullable(),
  nextSendName: z.string().nullable(),
  failing: z.number(),
});

export const insightDigestPreviewKpiSchema = z.object({
  id: z.string(),
  title: z.string(),
  value: z.number(),
  money: z.boolean(),
  deltaPct: z.number().nullable().optional(),
});

export const insightDigestPreviewChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  sparkline: z.array(z.number()),
});

export const insightDigestPreviewSchema = z.object({
  digestId: z.string(),
  digestName: z.string(),
  academyName: z.string(),
  sectionTitle: z.string(),
  periodLabel: z.string(),
  format: insightDigestFormatSchema,
  liveHref: z.string(),
  alerts: z.array(insightAlertSchema),
  kpis: z.array(insightDigestPreviewKpiSchema),
  charts: z.array(insightDigestPreviewChartSchema),
  currency: z.string().optional(),
});

export const insightDigestCatalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  defaultViz: insightVizTypeSchema,
});

export const insightDigestsQuerySchema = z.object({
  previewId: z.string().min(1).optional(),
});

export const insightDigestsResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    academyName: z.string(),
    actorEmail: z.string().nullable(),
    tenantDomains: z.array(z.string()),
    generatedAt: z.string(),
    sections: z.array(z.object({ slug: z.string(), title: z.string() })),
    timezones: z.array(z.string()),
    weekdays: z.array(z.object({ value: z.string(), label: z.string() })),
    catalog: z.array(insightDigestCatalogItemSchema),
    summary: insightDigestSummarySchema,
    digests: z.array(insightDigestItemSchema),
    preview: insightDigestPreviewSchema.nullable(),
  }),
});

export const insightDigestDraftSchema = z.object({
  name: z.string().min(1).max(120),
  sourceSlug: z.string().min(1),
  includeAlerts: z.boolean(),
  includeKpis: z.boolean(),
  widgetIds: z.array(z.string()),
  period: insightDigestPeriodSchema,
  format: insightDigestFormatSchema,
  recipients: z.array(z.string().email()),
  cadence: insightDigestCadenceSchema,
  weekday: z.string().min(1),
  monthDay: z.number().int().min(1).max(28).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1),
});

export const insightDigestsMutationBodySchema = z.object({
  action: z.enum(["create", "update", "delete", "toggle", "send-test"]),
  id: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  digest: insightDigestDraftSchema.optional(),
});

export const insightSettingsPatchSchema = z.object({
  defaultSection: z.string().min(1),
  defaultPeriod: insightDashboardRangeSchema,
  weekStartsOn: z.enum(["monday", "sunday"]),
  numberFormat: z.enum(["international", "european"]),
  autoRefresh: z.boolean(),
  refreshIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  showLastUpdated: z.boolean(),
  cacheMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
});

export const insightSettingsActivitySchema = z.object({
  at: z.string(),
  action: z.string(),
  actorLabel: z.string(),
});

export const insightSettingsAccessRowSchema = z.object({
  slug: z.string(),
  title: z.string(),
  href: z.string(),
  restricted: z.boolean(),
  visibleTo: z.array(z.object({ key: z.string(), name: z.string(), memberCount: z.number() })),
  dataClass: z.enum(["personal", "aggregated", "financial"]),
  layoutSource: z.enum(["tenant", "factory"]),
});

export const insightSettingsResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    generatedAt: z.string(),
    currency: z.string(),
    numberFormatSample: z.string(),
    settings: insightSettingsPatchSchema.extend({
      restrictedSlugs: z.array(z.string()),
    }),
    sections: z.array(z.object({ slug: z.string(), title: z.string() })),
    roles: z.array(z.object({ key: z.string(), name: z.string(), memberCount: z.number() })),
    access: z.array(insightSettingsAccessRowSchema),
    activity: z.array(insightSettingsActivitySchema),
  }),
});

export const insightSettingsMutationBodySchema = z.object({
  action: z.enum(["save", "restrict", "unrestrict", "reset-layout"]),
  settings: insightSettingsPatchSchema.optional(),
  targetSlug: z.string().min(1).optional(),
});

export type InsightWidget = z.infer<typeof insightWidgetSchema>;
export type InsightAlert = z.infer<typeof insightAlertSchema>;
export type InsightWidgetDetail = z.infer<typeof insightWidgetDetailResponseSchema>["data"];
export type InsightEngagementFunnelBoard = z.infer<
  typeof insightEngagementFunnelResponseSchema
>["data"];
export type InsightSalesPipelineBoard = z.infer<typeof insightSalesPipelineResponseSchema>["data"];
export type InsightSalesAttributionBoard = z.infer<
  typeof insightSalesAttributionResponseSchema
>["data"];
export type InsightSalesOpportunityBoard = z.infer<
  typeof insightSalesOpportunityResponseSchema
>["data"];
export type InsightContentHealthBoard = z.infer<typeof insightContentHealthResponseSchema>["data"];
export type InsightAlertsBoard = z.infer<typeof insightAlertsResponseSchema>["data"];
export type InsightAlertsMutationBody = z.infer<typeof insightAlertsMutationBodySchema>;
export type InsightLayout = z.infer<typeof insightLayoutSchema>;
export type InsightLayoutBoard = z.infer<typeof insightLayoutResponseSchema>["data"];
export type InsightLayoutMutationBody = z.infer<typeof insightLayoutMutationBodySchema>;
export type InsightLibraryBoard = z.infer<typeof insightLibraryResponseSchema>["data"];
export type InsightLibraryMutationBody = z.infer<typeof insightLibraryMutationBodySchema>;
export type InsightDigestsBoard = z.infer<typeof insightDigestsResponseSchema>["data"];
export type InsightDigestsMutationBody = z.infer<typeof insightDigestsMutationBodySchema>;
export type InsightDigestDraft = z.infer<typeof insightDigestDraftSchema>;
export type InsightSettingsBoard = z.infer<typeof insightSettingsResponseSchema>["data"];
export type InsightSettingsMutationBody = z.infer<typeof insightSettingsMutationBodySchema>;
