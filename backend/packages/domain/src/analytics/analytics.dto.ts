import { z } from "zod";
import {
  ANALYTICS_DASHBOARD_KEYS,
  ANALYTICS_FUNNEL_KEYS,
  ITEM_STATISTICS_WINDOW_KEYS,
} from "./analytics-definition-registry";

const rejectForbiddenQueryFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    subject_type: z.never().optional(),
    subjectType: z.never().optional(),
    subject_id: z.never().optional(),
    subjectId: z.never().optional(),
    rollup_key: z.never().optional(),
    rollupKey: z.never().optional(),
    metrics_json: z.never().optional(),
    metricsJson: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
    groupBy: z.never().optional(),
    aggregation: z.never().optional(),
    funnel_key: z.never().optional(),
    stage_key: z.never().optional(),
    window_key: z.never().optional(),
  })
  .loose();

const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date.");

export const analyticsDashboardQuerySchema = rejectForbiddenQueryFields
  .extend({
    dashboardKey: z.enum(ANALYTICS_DASHBOARD_KEYS).optional(),
    courseId: z.uuid().optional(),
    from: isoDateString.optional(),
    to: isoDateString.optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const analyticsFunnelQuerySchema = rejectForbiddenQueryFields
  .extend({
    funnelKey: z.enum(ANALYTICS_FUNNEL_KEYS).optional(),
    from: isoDateString.optional(),
    to: isoDateString.optional(),
  })
  .strict();

export const analyticsItemStatisticsQuerySchema = rejectForbiddenQueryFields
  .extend({
    assessmentId: z.uuid(),
    windowKey: z.enum(ITEM_STATISTICS_WINDOW_KEYS).default("rolling_30d"),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const analyticsMetricPointSchema = z
  .object({
    rollupKey: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const analyticsDashboardResponseSchema = z.object({
  data: z.object({
    dashboardKey: z.enum(ANALYTICS_DASHBOARD_KEYS),
    courseId: z.uuid().nullable(),
    from: z.string(),
    to: z.string(),
    metrics: z.array(analyticsMetricPointSchema),
    summary: z.object({
      totalEvents: z.number().int().nonnegative(),
    }),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const analyticsFunnelStageSchema = z
  .object({
    stageKey: z.string(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const analyticsFunnelDaySchema = z
  .object({
    day: z.string(),
    stages: z.array(analyticsFunnelStageSchema),
  })
  .strict();

export const analyticsFunnelResponseSchema = z.object({
  data: z.object({
    funnelKey: z.enum(ANALYTICS_FUNNEL_KEYS),
    from: z.string(),
    to: z.string(),
    days: z.array(analyticsFunnelDaySchema),
  }),
});

export const analyticsDistractorRateSchema = z
  .object({
    optionId: z.string(),
    rate: z.number().min(0).max(1),
  })
  .strict();

export const analyticsPsychometricQualityFlagSchema = z.enum(["bad", "fair", "good"]);

export const analyticsItemStatisticSchema = z
  .object({
    itemReference: z.object({
      itemId: z.uuid(),
      label: z.string(),
    }),
    attemptsCount: z.number().int().nonnegative(),
    correctCount: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1).nullable(),
    averageLatencyMs: z.number().int().nonnegative().nullable(),
    calculatedAt: z.string(),
    windowKey: z.enum(ITEM_STATISTICS_WINDOW_KEYS),
    difficulty: z.number().min(0).max(1).nullable(),
    discrimination: z.number().min(-1).max(1).nullable(),
    distractorRates: z.array(analyticsDistractorRateSchema).nullable(),
    sampleSizeWarning: z.boolean(),
    qualityFlag: analyticsPsychometricQualityFlagSchema,
  })
  .strict();

export const analyticsDashboardDrillDownQuerySchema = rejectForbiddenQueryFields
  .extend({
    rollupKey: z.string().min(1),
    day: isoDateString,
    courseId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const analyticsDashboardDrillDownMemberSchema = z
  .object({
    membershipId: z.uuid(),
    displayName: z.string(),
  })
  .strict();

export const analyticsDashboardDrillDownResponseSchema = z.object({
  data: z.object({
    rollupKey: z.string(),
    day: z.string(),
    members: z.array(analyticsDashboardDrillDownMemberSchema),
    capped: z.boolean(),
  }),
});

export const analyticsItemStatisticsResponseSchema = z.object({
  data: z.object({
    assessmentId: z.uuid(),
    windowKey: z.enum(ITEM_STATISTICS_WINDOW_KEYS),
    items: z.array(analyticsItemStatisticSchema),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export type AnalyticsDashboardQuery = z.output<typeof analyticsDashboardQuerySchema>;
export type AnalyticsFunnelQuery = z.output<typeof analyticsFunnelQuerySchema>;
export type AnalyticsItemStatisticsQuery = z.output<typeof analyticsItemStatisticsQuerySchema>;
export type AnalyticsDashboardDrillDownQuery = z.output<
  typeof analyticsDashboardDrillDownQuerySchema
>;
