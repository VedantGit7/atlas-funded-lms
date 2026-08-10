import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const OUTLIER_CATEGORIES = [
  "all",
  "far_below",
  "far_above",
  "unresolved",
  "no_records",
  "short_duration",
  "started_late",
] as const;

export type OutlierCategory = (typeof OUTLIER_CATEGORIES)[number];

export const OUTLIER_FINDING_CATEGORIES = [
  "far_below",
  "far_above",
  "unresolved",
  "no_records",
  "short_duration",
  "started_late",
] as const;

export type OutlierFindingCategory = (typeof OUTLIER_FINDING_CATEGORIES)[number];

export const OUTLIER_SEVERITIES = ["notable", "worth_checking", "data_quality"] as const;
export type OutlierSeverity = (typeof OUTLIER_SEVERITIES)[number];

export const outlierThresholdsSchema = z
  .object({
    rateDeltaPts: z.coerce.number().min(1).max(100).default(20),
    unresolvedPct: z.coerce.number().min(1).max(100).default(20),
    shortDurationPct: z.coerce.number().min(1).max(100).default(25),
    lateStartMinutes: z.coerce.number().min(1).max(240).default(15),
    ignoreSmallSessions: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return true;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      })
      .pipe(z.boolean()),
    minRecords: z.coerce.number().int().min(0).max(1000).default(5),
  })
  .strict();

export type OutlierThresholds = z.output<typeof outlierThresholdsSchema>;

export const DEFAULT_OUTLIER_THRESHOLDS: OutlierThresholds = {
  rateDeltaPts: 20,
  unresolvedPct: 20,
  shortDurationPct: 25,
  lateStartMinutes: 15,
  ignoreSmallSessions: true,
  minRecords: 5,
};

export const superLiveInsightsOutliersQuerySchema = rejectClientTenantFields
  .extend({
    startedFrom: z.string().datetime(),
    startedTo: z.string().datetime(),
    category: z.enum(OUTLIER_CATEGORIES).default("all"),
    rateDeltaPts: z.coerce.number().min(1).max(100).optional(),
    unresolvedPct: z.coerce.number().min(1).max(100).optional(),
    shortDurationPct: z.coerce.number().min(1).max(100).optional(),
    lateStartMinutes: z.coerce.number().min(1).max(240).optional(),
    ignoreSmallSessions: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
    minRecords: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .strict();

export type SuperLiveInsightsOutliersQuery = z.output<typeof superLiveInsightsOutliersQuerySchema>;

const evidenceChipSchema = z.object({
  label: z.string(),
  tone: z.enum(["success", "warning", "danger", "muted", "ink"]).default("muted"),
});

const findingSchema = z.object({
  id: z.string(),
  sessionId: z.string().uuid(),
  category: z.enum(OUTLIER_FINDING_CATEGORIES),
  severity: z.enum(OUTLIER_SEVERITIES),
  title: z.string(),
  sessionTitle: z.string(),
  courseTitle: z.string().nullable(),
  batchName: z.string().nullable(),
  scheduledAt: z.string().datetime().nullable(),
  evidence: z.array(evidenceChipSchema),
  composition: z.object({
    attendedCount: z.number().int().nonnegative(),
    registeredCount: z.number().int().nonnegative(),
    absentCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
  }),
  metrics: z.object({
    attendanceRate: z.number().nullable(),
    courseAvgRate: z.number().nullable(),
    avgDurationSeconds: z.number().int().nullable(),
    sessionDurationSeconds: z.number().int().nullable(),
    startDelaySeconds: z.number().int().nullable(),
  }),
});

export const superLiveInsightsOutliersResponseSchema = z
  .object({
    data: z.object({
      category: z.enum(OUTLIER_CATEGORIES),
      thresholds: outlierThresholdsSchema,
      counts: z.object({
        all: z.number().int().nonnegative(),
        far_below: z.number().int().nonnegative(),
        far_above: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
        no_records: z.number().int().nonnegative(),
        short_duration: z.number().int().nonnegative(),
        started_late: z.number().int().nonnegative(),
      }),
      dataQualityRecordsAffected: z.number().int().nonnegative(),
      findings: z.array(findingSchema),
    }),
  })
  .strict();

export type SuperLiveInsightsOutliersResponse = z.output<
  typeof superLiveInsightsOutliersResponseSchema
>;

export const superLiveInsightsOutliersPreviewQuerySchema = rejectClientTenantFields
  .extend({
    startedFrom: z.string().datetime(),
    startedTo: z.string().datetime(),
    rateDeltaPts: z.coerce.number().min(1).max(100).optional(),
    unresolvedPct: z.coerce.number().min(1).max(100).optional(),
    shortDurationPct: z.coerce.number().min(1).max(100).optional(),
    lateStartMinutes: z.coerce.number().min(1).max(240).optional(),
    ignoreSmallSessions: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
    minRecords: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .strict();

export type SuperLiveInsightsOutliersPreviewQuery = z.output<
  typeof superLiveInsightsOutliersPreviewQuerySchema
>;

export const superLiveInsightsOutliersPreviewResponseSchema = z
  .object({
    data: z.object({
      findingCount: z.number().int().nonnegative(),
      thresholds: outlierThresholdsSchema,
    }),
  })
  .strict();
