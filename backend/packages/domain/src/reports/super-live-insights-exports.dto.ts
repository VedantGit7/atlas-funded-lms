import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const SLI_EXPORT_DATASETS = [
  "session_metrics",
  "trend_series",
  "series_rollup",
  "outlier_findings",
] as const;

export const SLI_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const SLI_EXPORT_DELIVERY = ["download", "email_me", "send_recipients"] as const;
export const SLI_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const SLI_EXPORT_DATE_PRESETS = ["7d", "30d", "90d", "custom"] as const;
export const SLI_EXPORT_SCOPE_MODES = ["date_range", "course", "batch", "sessions"] as const;
export const SLI_EXPORT_SERIES_KINDS = ["course", "batch"] as const;
export const SLI_EXPORT_GRANULARITIES = ["day", "week", "month"] as const;

export const SLI_EXPORT_COLUMNS = [
  "title",
  "status",
  "course_title",
  "batch_name",
  "scheduled_at",
  "started_at",
  "ended_at",
  "duration_seconds",
  "attended_count",
  "registered_count",
  "absent_count",
  "total_count",
  "avg_duration_seconds",
  "attendance_rate",
  "tenant_avg_rate",
  "course_avg_rate",
] as const;

export const sliExportHistoryItemSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(SLI_EXPORT_DATASETS),
    datasetLabel: z.string(),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
    requestedByLabel: z.string(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    expired: z.boolean(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    downloadAvailable: z.boolean(),
  })
  .strict();

export const sliExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    dataset: z.enum(SLI_EXPORT_DATASETS),
    datasetLabel: z.string(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    formats: z.array(z.enum(REPORT_FORMATS)),
    isActive: z.boolean(),
    nextRunAt: z.iso.datetime(),
    nextRunLabel: z.string(),
    recipients: z.array(z.string()),
    delivery: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const superLiveInsightsExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(sliExportHistoryItemSchema),
    schedules: z.array(sliExportScheduleItemSchema),
    capabilities: z.object({
      formats: z.array(z.enum(SLI_EXPORT_FORMATS)),
      datasets: z.array(z.enum(SLI_EXPORT_DATASETS)),
      columns: z.array(z.enum(SLI_EXPORT_COLUMNS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      note: z.string(),
    }),
    estimates: z.object({
      sessionMetricsRows: z.number().int().nonnegative().nullable(),
      outlierFindingsRows: z.number().int().nonnegative().nullable(),
    }),
  }),
});

export const createSuperLiveInsightsExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(SLI_EXPORT_DATASETS).default("session_metrics"),
    format: z.enum(SLI_EXPORT_FORMATS).default("csv"),
    scopeMode: z.enum(SLI_EXPORT_SCOPE_MODES).default("date_range"),
    datePreset: z.enum(SLI_EXPORT_DATE_PRESETS).default("30d"),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    sessionIds: z.array(z.uuid()).max(200).optional(),
    columns: z.array(z.enum(SLI_EXPORT_COLUMNS)).min(1).max(30).optional(),
    includeBenchmarks: z.boolean().default(true),
    granularity: z.enum(SLI_EXPORT_GRANULARITIES).default("week"),
    seriesKind: z.enum(SLI_EXPORT_SERIES_KINDS).default("course"),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(SLI_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.email()).max(20).optional(),
    webhookUrl: z.url().max(500).optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(SLI_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateSuperLiveInsightsExportBody = z.output<
  typeof createSuperLiveInsightsExportBodySchema
>;

export const createSuperLiveInsightsExportResponseSchema = z.object({
  data: z.object({
    run: sliExportHistoryItemSchema,
    schedule: sliExportScheduleItemSchema.nullable(),
  }),
});

export const superLiveInsightsExportRunParamsSchema = z
  .object({
    runId: z.uuid(),
  })
  .strict();

export const superLiveInsightsExportRunDetailResponseSchema = z.object({
  data: sliExportHistoryItemSchema,
});

export const retrySuperLiveInsightsExportResponseSchema = z.object({
  data: sliExportHistoryItemSchema,
});

export const retrySuperLiveInsightsExportBodySchema = rejectClientTenantFields
  .extend({
    format: z.enum(SLI_EXPORT_FORMATS).optional(),
  })
  .strict();

export const superLiveInsightsExportScheduleParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const updateSuperLiveInsightsExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateSuperLiveInsightsExportScheduleResponseSchema = z.object({
  data: sliExportScheduleItemSchema,
});

export const deleteSuperLiveInsightsExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});
