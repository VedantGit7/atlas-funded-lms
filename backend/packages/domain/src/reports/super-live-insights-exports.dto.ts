import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import {
  REPORT_EXPORT_CADENCE,
  REPORT_EXPORT_FORMATS,
  exportDatasetFields,
  exportRunFileFields,
  exportRunScopeFields,
  exportRunStateFields,
  exportScheduleDeliveryField,
  exportScheduleTimingFields,
  reportExportResponseSchemas,
} from "./report-exports.dto";

export const SLI_EXPORT_DATASETS = [
  "session_metrics",
  "trend_series",
  "series_rollup",
  "outlier_findings",
] as const;

export const SLI_EXPORT_DELIVERY = ["download", "email_me", "send_recipients"] as const;
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
    ...exportRunFileFields,
    ...exportDatasetFields(SLI_EXPORT_DATASETS),
    ...exportRunScopeFields,
    requestedByLabel: z.string(),
    ...exportRunStateFields,
  })
  .strict();

export const sliExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    ...exportDatasetFields(SLI_EXPORT_DATASETS),
    ...exportScheduleTimingFields,
    ...exportScheduleDeliveryField,
  })
  .strict();

export const superLiveInsightsExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(sliExportHistoryItemSchema),
    schedules: z.array(sliExportScheduleItemSchema),
    capabilities: z.object({
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
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
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
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
    cadence: z.enum(REPORT_EXPORT_CADENCE).optional(),
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

const exportResponses = reportExportResponseSchemas(
  sliExportHistoryItemSchema,
  sliExportScheduleItemSchema,
);

export const createSuperLiveInsightsExportResponseSchema = exportResponses.create;
export const superLiveInsightsExportRunDetailResponseSchema = exportResponses.runDetail;
export const retrySuperLiveInsightsExportResponseSchema = exportResponses.retry;
export const updateSuperLiveInsightsExportScheduleResponseSchema = exportResponses.updateSchedule;

export const retrySuperLiveInsightsExportBodySchema = rejectClientTenantFields
  .extend({
    format: z.enum(REPORT_EXPORT_FORMATS).optional(),
  })
  .strict();
