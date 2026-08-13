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
    pairedWidget: insightWidgetSchema.nullable().optional(),
    secondaryAverage: z.number().nullable().optional(),
    secondaryTotal: z.number().nullable().optional(),
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

export const insightMessengerChannelsOutboundIdSchema = z.enum([
  "email",
  "push",
  "whatsapp",
  "announcements",
]);

export const insightMessengerChannelsComparisonRowSchema = z.object({
  id: insightMessengerChannelsOutboundIdSchema,
  label: z.string(),
  sends: z.number(),
  recipients: z.number(),
  recipientsPerSend: z.number().nullable(),
  sendSharePct: z.number(),
  reachSharePct: z.number(),
  href: z.string(),
});

export const insightMessengerChannelsVolumePointSchema = z.object({
  period: z.string(),
  email: z.number(),
  push: z.number(),
  whatsapp: z.number(),
  inbox: z.number(),
  outboundTotal: z.number(),
});

export const insightMessengerChannelsOutboundRowSchema = z.object({
  id: insightMessengerChannelsOutboundIdSchema,
  label: z.string(),
  direction: z.literal("outbound"),
  sends: z.number(),
  recipients: z.number(),
  recipientsPerSend: z.number().nullable(),
  sendSharePct: z.number(),
  reachSharePct: z.number(),
  lastSentAt: z.string().nullable(),
  href: z.string(),
});

export const insightMessengerChannelsInboundRowSchema = z.object({
  id: z.literal("inbox"),
  label: z.literal("Inbox messages"),
  direction: z.literal("inbound"),
  messageCount: z.number(),
  openConversations: z.number(),
  href: z.string(),
});

export const insightMessengerChannelsResponseSchema = z.object({
  data: z.object({
    slug: z.literal("messenger-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    manageCampaignsHref: z.string(),
    inboxHref: z.string(),
    caveat: z.string(),
    volumeCaption: z.string(),
    empty: z.boolean(),
    singleChannel: z.boolean(),
    unusedChannels: z.array(z.string()),
    unusedCaption: z.string().nullable(),
    headline: z.object({
      outboundReach: z.number(),
      campaignsSent: z.number(),
      avgReachPerCampaign: z.number().nullable(),
      channelsUsed: z.number(),
      scheduledTotal: z.number(),
      scheduledCaption: z.literal("Email, push, and WhatsApp combined"),
    }),
    comparison: z.object({
      caption: z.string().nullable(),
      rows: z.array(insightMessengerChannelsComparisonRowSchema),
    }),
    volume: z.object({
      averageOutbound: z.number().nullable(),
      points: z.array(insightMessengerChannelsVolumePointSchema),
    }),
    table: z.object({
      outbound: z.array(insightMessengerChannelsOutboundRowSchema),
      inbound: z.array(insightMessengerChannelsInboundRowSchema),
    }),
  }),
});

export const insightMessengerWhatsappGuidanceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  href: z.string(),
});

export const insightMessengerWhatsappFailurePointSchema = z.object({
  period: z.string(),
  delivered: z.number(),
  failed: z.number(),
});

export const insightMessengerWhatsappCampaignRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  recipients: z.number(),
  delivered: z.number(),
  failed: z.number(),
  deliveryRatePct: z.number().nullable(),
  belowAverage: z.boolean(),
  fullyFailed: z.boolean(),
  sentAt: z.string().nullable(),
  href: z.string(),
});

export const insightMessengerWhatsappResponseSchema = z.object({
  data: z.object({
    slug: z.literal("messenger-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    settingsHref: z.string(),
    connected: z.boolean(),
    lastSentAt: z.string().nullable(),
    empty: z.boolean(),
    perfectDelivery: z.boolean(),
    historical: z.boolean(),
    headline: z.object({
      deliveryRatePct: z.number().nullable(),
      deliveryRateCaption: z.string().nullable(),
      campaignsSent: z.number(),
      delivered: z.number(),
      failed: z.number(),
      failedSharePct: z.number().nullable(),
      scheduled: z.number(),
    }),
    composition: z.object({
      delivered: z.number(),
      failed: z.number(),
      pending: z.number(),
      recipients: z.number(),
      caption: z.string(),
    }),
    failures: z.object({
      caption: z.string().nullable(),
      points: z.array(insightMessengerWhatsappFailurePointSchema),
    }),
    guidance: z.object({
      caption: z.string(),
      items: z.array(insightMessengerWhatsappGuidanceItemSchema),
    }),
    campaigns: z.object({
      averageDeliveryRatePct: z.number().nullable(),
      rows: z.array(insightMessengerWhatsappCampaignRowSchema),
    }),
  }),
});

export const insightMessengerInboxVolumePointSchema = z.object({
  period: z.string(),
  count: z.number(),
  isWeekend: z.boolean(),
});

export const insightMessengerInboxConversationRowSchema = z.object({
  id: z.string(),
  learnerName: z.string(),
  lastMessagePreview: z.string(),
  messageCount: z.number(),
  lastMessageAt: z.string(),
  waitingOn: z.enum(["us", "learner"]),
  waitingPast48h: z.boolean(),
  href: z.string(),
});

export const insightMessengerInboxResponseBucketSchema = z.object({
  id: z.enum(["0-1h", "1-4h", "4-24h", "24h+"]),
  label: z.string(),
  count: z.number(),
  sharePct: z.number().nullable(),
});

export const insightMessengerInboxResponseSchema = z.object({
  data: z.object({
    slug: z.literal("messenger-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    inboxHref: z.string(),
    alertsHref: z.string(),
    directionNote: z.string(),
    empty: z.boolean(),
    allClear: z.boolean(),
    headline: z.object({
      inboxMessages: z.number(),
      inboxMessages30d: z.number(),
      inboxMessagesCaption: z.string(),
      openConversations: z.number(),
      messages30d: z.number(),
      averagePerDay: z.number().nullable(),
      busiestDay: z
        .object({
          period: z.string(),
          count: z.number(),
        })
        .nullable(),
      quietestDay: z
        .object({
          period: z.string(),
          count: z.number(),
        })
        .nullable(),
    }),
    volume: z.object({
      mean: z.number().nullable(),
      caption: z.string().nullable(),
      points: z.array(insightMessengerInboxVolumePointSchema),
    }),
    conversations: z.object({
      totalOpen: z.number(),
      rows: z.array(insightMessengerInboxConversationRowSchema),
    }),
    responseTime: z.object({
      available: z.boolean(),
      medianFirstReplySeconds: z.number().nullable(),
      longestFirstReplySeconds: z.number().nullable(),
      longestWaitingSeconds: z.number().nullable(),
      caption: z.string().nullable(),
      buckets: z.array(insightMessengerInboxResponseBucketSchema),
    }),
    noAlerting: z.object({
      caption: z.string(),
      href: z.string(),
    }),
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

export const insightMarketingAttributionPatternSchema = z.enum([
  "high-volume low-value",
  "low-volume high-value",
]);

export const insightMarketingAttributionRowSchema = z.object({
  id: z.string(),
  value: z.string(),
  events: z.number(),
  revenueMajor: z.number(),
  eventSharePct: z.number().nullable(),
  revenueSharePct: z.number().nullable(),
  revenuePerEvent: z.number().nullable(),
  residual: z.number().nullable(),
  unstable: z.boolean(),
  href: z.string(),
  pattern: insightMarketingAttributionPatternSchema.nullable(),
});

export const insightMarketingAttributionCompositionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["named", "other", "not-set"]),
  events: z.number(),
  sharePct: z.number().nullable(),
});

export const insightMarketingAttributionDimensionSchema = z.object({
  id: z.enum(["source", "medium", "campaign"]),
  label: z.string(),
  composition: z.array(insightMarketingAttributionCompositionSchema),
  rows: z.array(insightMarketingAttributionRowSchema),
  caption: z.string(),
  maxEvents: z.number(),
  maxRevenue: z.number(),
  revenuePerEvent: z.number().nullable(),
});

export const insightMarketingAttributionCrossPairSchema = z.object({
  source: z.string(),
  medium: z.string(),
  events: z.number(),
  sharePct: z.number(),
});

export const insightMarketingAttributionResponseSchema = z.object({
  data: z.object({
    slug: z.literal("marketing-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    currency: z.string(),
    reportHref: z.string(),
    salesAttributionHref: z.string(),
    trackingHref: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    caption: z.string(),
    events: z.number(),
    events30d: z.number(),
    attributedRevenue: z.number(),
    sourceCount: z.number(),
    mediumCount: z.number(),
    campaignCount: z.number(),
    campaignsWithRevenue: z.number(),
    unstableEventThreshold: z.number(),
    dimensions: z.object({
      source: insightMarketingAttributionDimensionSchema,
      medium: insightMarketingAttributionDimensionSchema,
      campaign: insightMarketingAttributionDimensionSchema,
    }),
    crossPairs: z.array(insightMarketingAttributionCrossPairSchema),
    crossCaption: z.string().nullable(),
  }),
});

export const insightAttributionResponseSchema = z.object({
  data: z.discriminatedUnion("slug", [
    insightSalesAttributionResponseSchema.shape.data,
    insightMarketingAttributionResponseSchema.shape.data,
  ]),
});

export const insightMarketingCaptureChainStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
  barSharePct: z.number(),
  connectorRatePct: z.number().nullable(),
  connectorIsLargestDrop: z.boolean(),
});

export const insightMarketingCaptureChainSchema = z.object({
  steps: z.array(insightMarketingCaptureChainStepSchema),
  caption: z.string(),
  dropCaption: z.string().nullable(),
});

export const insightMarketingCaptureFormRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  submissions: z.number(),
  submissionSharePct: z.number().nullable(),
  submissions30d: z.number(),
  submissions30dWarning: z.boolean(),
  lastSubmissionAt: z.string().nullable(),
  href: z.string(),
  isDraft: z.boolean(),
  warningRail: z.boolean(),
});

export const insightMarketingCaptureCtaRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  ctaType: z.string(),
  status: z.string(),
  views: z.number(),
  clicks: z.number(),
  clickRatePct: z.number().nullable(),
  clickRateWarning: z.boolean(),
  noViews: z.boolean(),
  href: z.string(),
});

export const insightMarketingCaptureClickRateByTypeRowSchema = z.object({
  type: z.string(),
  views: z.number(),
  clicks: z.number(),
  clickRatePct: z.number().nullable(),
  unstable: z.boolean(),
});

export const insightMarketingCaptureClickRateByTypeSchema = z.object({
  rows: z.array(insightMarketingCaptureClickRateByTypeRowSchema),
  overallRatePct: z.number().nullable(),
  caption: z.string().nullable(),
});

export const insightMarketingCaptureResponseSchema = z.object({
  data: z.object({
    slug: z.literal("marketing-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    empty: z.boolean(),
    zeroSubmissionWarning: z.boolean(),
    warningMessage: z.string().nullable(),
    warningTitle: z.string().nullable(),
    chainCaption: z.string(),
    formsCaption: z.string(),
    manageFormsHref: z.string(),
    manageCtasHref: z.string(),
    createFormHref: z.string(),
    emptyCaption: z.string(),
    clickRateWarnThreshold: z.number(),
    unstableViewThreshold: z.number(),
    overallClickRatePct: z.number().nullable(),
    ctaViews: z.number(),
    ctaClicks: z.number(),
    submissionCount: z.number(),
    submissions30d: z.number(),
    submissions30dWarning: z.boolean(),
    formCount: z.number(),
    liveFormCount: z.number(),
    ctaCount: z.number(),
    liveCtaCount: z.number(),
    contactCount: z.number(),
    chain: insightMarketingCaptureChainSchema,
    forms: z.array(insightMarketingCaptureFormRowSchema),
    ctas: z.array(insightMarketingCaptureCtaRowSchema),
    clickRateByType: insightMarketingCaptureClickRateByTypeSchema,
  }),
});

export const insightMarketingWorkflowsDailyVolumeSchema = z.object({
  period: z.string(),
  completed: z.number(),
  failed: z.number(),
  total: z.number(),
});

export const insightMarketingWorkflowsByWorkflowRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  runs30d: z.number(),
  failed30d: z.number(),
  runSharePct: z.number().nullable(),
  successRatePct: z.number().nullable(),
  lastRunAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  href: z.string(),
  warningRail: z.boolean(),
});

export const insightMarketingWorkflowsTriggerRowSchema = z.object({
  trigger: z.string(),
  runs: z.number(),
  sharePct: z.number().nullable(),
});

export const insightMarketingWorkflowsNeverRunRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  publishedAt: z.string().nullable(),
  href: z.string(),
});

export const insightMarketingWorkflowsLedgerRowSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowTitle: z.string(),
  status: z.string(),
  triggerEventType: z.string(),
  createdAt: z.string(),
  errorMessage: z.string().nullable(),
  errorPreview: z.string().nullable(),
  href: z.string(),
  workflowHref: z.string(),
  isFailed: z.boolean(),
});

export const insightMarketingWorkflowsResponseSchema = z.object({
  data: z.object({
    slug: z.literal("marketing-insight"),
    title: z.string(),
    subtitle: z.string(),
    generatedAt: z.string(),
    empty: z.boolean(),
    allHealthy: z.boolean(),
    emptyCaption: z.string(),
    manageWorkflowsHref: z.string(),
    failureShareWarnThreshold: z.number(),
    failureMinRuns: z.number(),
    workflowCount: z.number(),
    publishedWorkflowCount: z.number(),
    runs30d: z.number(),
    runsCompleted30d: z.number(),
    runsFailed30d: z.number(),
    successRatePct: z.number().nullable(),
    lastRunAt: z.string().nullable(),
    runsCaption: z.string(),
    volumeCaption: z.string(),
    volumeAllHealthyCaption: z.string().nullable(),
    neverRunCaption: z.string(),
    dailyVolume: z.array(insightMarketingWorkflowsDailyVolumeSchema),
    byWorkflow: z.array(insightMarketingWorkflowsByWorkflowRowSchema),
    triggers: z.array(insightMarketingWorkflowsTriggerRowSchema),
    neverRun: z.array(insightMarketingWorkflowsNeverRunRowSchema),
    ledger: z.array(insightMarketingWorkflowsLedgerRowSchema),
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

export const insightLiveNowSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  attendedCount: z.number(),
  registeredCount: z.number(),
  rosteredCount: z.number(),
  attendanceRate: z.number(),
  expectedAttended: z.number().nullable(),
  fillRate: z.number().nullable(),
  batchId: z.string().nullable(),
  batchKey: z.string().nullable(),
  batchLabel: z.string().nullable(),
  href: z.string(),
  watchHref: z.string(),
});

export const insightLiveNowNextGroupSchema = z.object({
  id: z.enum(["within-hour", "later-today", "later"]),
  label: z.string(),
  count: z.number(),
  sessions: z.array(insightLiveNowSessionSchema),
});

export const insightLiveNowResponseSchema = z.object({
  data: z.object({
    slug: z.literal("live-dashboard"),
    title: z.string(),
    generatedAt: z.string(),
    caveat: z.string(),
    quiet: z.boolean(),
    attendanceHref: z.string(),
    sessionsHref: z.string(),
    dashboardHref: z.string(),
    attendanceRate30d: z.number(),
    liveSessions: z.array(insightLiveNowSessionSchema),
    nextUpGroups: z.array(insightLiveNowNextGroupSchema),
    nextUpCount: z.number(),
    endedToday: z.array(insightLiveNowSessionSchema),
    endedTodayTotal: z.number(),
    nextSession: z
      .object({
        id: z.string(),
        title: z.string(),
        scheduledAt: z.string().nullable(),
        href: z.string(),
      })
      .nullable(),
  }),
});

export const insightLiveSessionsQuerySchema = z.object({
  view: z.enum(["all", "low-turnout", "upcoming", "live"]).default("all"),
  q: z.string().optional().default(""),
  status: z.enum(["all", "live", "scheduled", "ended", "cancelled"]).default("all"),
  turnout: z.enum(["all", "below-50", "above-50", "no-roster"]).default("all"),
  watch: z.enum(["all", "short", "long"]).default("all"),
  sort: z
    .enum(["scheduled_desc", "scheduled_asc", "rate_asc", "rate_desc", "attended_desc"])
    .default("scheduled_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const insightLiveSessionsRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  scheduledAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  attendedCount: z.number(),
  registeredCount: z.number(),
  rosteredCount: z.number(),
  attendanceRate: z.number().nullable(),
  avgWatchMinutes: z.number().nullable(),
  durationMinutes: z.number().nullable(),
  batchId: z.string().nullable(),
  batchLabel: z.string().nullable(),
  courseLabel: z.string().nullable(),
  href: z.string(),
  accent: z.enum(["live", "low", "none"]),
  selectable: z.boolean(),
});

export const insightLiveSessionsHistogramBucketSchema = z.object({
  id: z.string(),
  label: z.string(),
  from: z.number(),
  to: z.number(),
  count: z.number(),
  belowThreshold: z.boolean(),
});

export const insightLiveSessionsResponseSchema = z.object({
  data: z.object({
    slug: z.literal("live-dashboard"),
    title: z.string(),
    generatedAt: z.string(),
    days: z.number(),
    windowLabel: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    allHealthy: z.boolean(),
    attendanceHref: z.string(),
    sessionsHref: z.string(),
    dashboardHref: z.string(),
    nowHref: z.string(),
    query: z.object({
      view: z.enum(["all", "low-turnout", "upcoming", "live"]),
      q: z.string(),
      status: z.enum(["all", "live", "scheduled", "ended", "cancelled"]),
      turnout: z.enum(["all", "below-50", "above-50", "no-roster"]),
      watch: z.enum(["all", "short", "long"]),
      sort: z.enum(["scheduled_desc", "scheduled_asc", "rate_asc", "rate_desc", "attended_desc"]),
      page: z.number(),
      pageSize: z.number(),
    }),
    summary: z.object({
      sessionCount: z.number(),
      endedCount: z.number(),
      upcomingCount: z.number(),
      liveCount: z.number(),
      cancelledCount: z.number(),
      attendanceRate: z.number(),
      below50Count: z.number(),
      endedWithRosterCount: z.number(),
      avgWatchMinutes: z.number(),
      totalWatchHours: z.number(),
    }),
    histogram: z.object({
      buckets: z.array(insightLiveSessionsHistogramBucketSchema),
      maxCount: z.number(),
      median: z.number().nullable(),
      mean: z.number().nullable(),
      belowThresholdCount: z.number(),
      belowThresholdSharePct: z.number().nullable(),
      caption: z.string(),
    }),
    sessions: z.array(insightLiveSessionsRowSchema),
    totalFiltered: z.number(),
    page: z.number(),
    pageSize: z.number(),
    pageCount: z.number(),
  }),
});

export const insightLiveAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(8),
});

export const insightLiveAttendanceDaySchema = z.object({
  period: z.string(),
  label: z.string(),
  attended: z.number(),
  registered: z.number(),
  gap: z.number(),
  rate: z.number().nullable(),
  sessionCount: z.number(),
  weekday: z.number(),
  isWeekend: z.boolean(),
  gapAlert: z.boolean(),
});

export const insightLiveAttendanceResponseSchema = z.object({
  data: z.object({
    slug: z.literal("live-dashboard"),
    title: z.string(),
    generatedAt: z.string(),
    days: z.number(),
    windowLabel: z.string(),
    caveat: z.string(),
    empty: z.boolean(),
    attendanceHref: z.string(),
    sessionsHref: z.string(),
    dashboardHref: z.string(),
    sessionsBoardHref: z.string(),
    nowHref: z.string(),
    query: z.object({
      page: z.number(),
      pageSize: z.number(),
    }),
    summary: z.object({
      attendanceRate: z.number(),
      attended: z.number(),
      rostered: z.number(),
      noShowGap: z.number(),
      noShowPct: z.number(),
      avgDailyGap: z.number(),
      bestDay: z
        .object({
          period: z.string(),
          label: z.string(),
          rate: z.number(),
        })
        .nullable(),
      worstDay: z
        .object({
          period: z.string(),
          label: z.string(),
          rate: z.number(),
        })
        .nullable(),
    }),
    trend: z.object({
      points: z.array(
        z.object({
          period: z.string(),
          label: z.string(),
          attended: z.number(),
          registered: z.number(),
          gap: z.number(),
          rate: z.number().nullable(),
          isWeekend: z.boolean(),
        }),
      ),
      maxValue: z.number(),
      meanAttended: z.number(),
      caption: z.string(),
    }),
    weekdayGaps: z.array(
      z.object({
        weekday: z.number(),
        label: z.string(),
        gapRate: z.number().nullable(),
        sampleDays: z.number(),
        highlight: z.boolean(),
      }),
    ),
    weekdayCaption: z.string(),
    topGapSessions: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        rostered: z.number(),
        attended: z.number(),
        gap: z.number(),
        href: z.string(),
      }),
    ),
    scatter: z.object({
      points: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          rostered: z.number(),
          rate: z.number(),
          x: z.number(),
          y: z.number(),
          href: z.string(),
        }),
      ),
      caption: z.string(),
    }),
    daily: z.array(insightLiveAttendanceDaySchema),
    totalDaily: z.number(),
    page: z.number(),
    pageSize: z.number(),
    pageCount: z.number(),
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
  recipients: z.array(z.email()),
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
export type InsightMessengerChannelsBoard = z.infer<
  typeof insightMessengerChannelsResponseSchema
>["data"];
export type InsightMessengerWhatsappBoard = z.infer<
  typeof insightMessengerWhatsappResponseSchema
>["data"];
export type InsightMessengerInboxBoard = z.infer<
  typeof insightMessengerInboxResponseSchema
>["data"];
export type InsightSalesAttributionBoard = z.infer<
  typeof insightSalesAttributionResponseSchema
>["data"];
export type InsightMarketingAttributionBoard = z.infer<
  typeof insightMarketingAttributionResponseSchema
>["data"];
export type InsightMarketingCaptureBoard = z.infer<
  typeof insightMarketingCaptureResponseSchema
>["data"];
export type InsightMarketingWorkflowsBoard = z.infer<
  typeof insightMarketingWorkflowsResponseSchema
>["data"];
export type InsightAttributionBoard =
  | InsightSalesAttributionBoard
  | InsightMarketingAttributionBoard;
export type InsightSalesOpportunityBoard = z.infer<
  typeof insightSalesOpportunityResponseSchema
>["data"];
export type InsightContentHealthBoard = z.infer<typeof insightContentHealthResponseSchema>["data"];
export type InsightLiveNowBoard = z.infer<typeof insightLiveNowResponseSchema>["data"];
export type InsightLiveSessionsBoard = z.infer<typeof insightLiveSessionsResponseSchema>["data"];
export type InsightLiveSessionsQuery = z.infer<typeof insightLiveSessionsQuerySchema>;
export type InsightLiveAttendanceBoard = z.infer<
  typeof insightLiveAttendanceResponseSchema
>["data"];
export type InsightLiveAttendanceQuery = z.infer<typeof insightLiveAttendanceQuerySchema>;
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
