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

export const RU_EXPORT_DATASETS = [
  "meter_snapshot",
  "metric_history",
  "storage_breakdown",
  "inactive_learners",
  "dormant_content",
] as const;

export const RU_EXPORT_DELIVERY = ["download", "email_me", "send_recipients"] as const;
export const RU_EXPORT_DATE_PRESETS = ["7d", "30d", "90d", "custom"] as const;
export const RU_EXPORT_SCOPE_MODES = ["all", "metric", "search"] as const;

export const RU_EXPORT_COLUMNS = [
  "metric_key",
  "metric_label",
  "period",
  "value",
  "unit",
  "calculated_at",
  "resource_type",
  "object_count",
  "storage_gb",
  "course_id",
  "title",
  "status",
  "lesson_count",
  "last_learner_activity_at",
  "created_at",
  "membership_id",
  "learner_name",
  "email",
  "last_active_at",
] as const;

export const ruExportHistoryItemSchema = z
  .object({
    ...exportRunFileFields,
    ...exportDatasetFields(RU_EXPORT_DATASETS),
    ...exportRunScopeFields,
    requestedByLabel: z.string(),
    ...exportRunStateFields,
  })
  .strict();

export const ruExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    ...exportDatasetFields(RU_EXPORT_DATASETS),
    ...exportScheduleTimingFields,
    ...exportScheduleDeliveryField,
  })
  .strict();

export const resourceUsageExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(ruExportHistoryItemSchema),
    schedules: z.array(ruExportScheduleItemSchema),
    capabilities: z.object({
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
      datasets: z.array(z.enum(RU_EXPORT_DATASETS)),
      columns: z.array(z.enum(RU_EXPORT_COLUMNS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      note: z.string(),
      unmeteredNote: z.string(),
    }),
    estimates: z.object({
      meterSnapshotRows: z.number().int().nonnegative().nullable(),
      inactiveLearnerRows: z.number().int().nonnegative().nullable(),
    }),
  }),
});

export const createResourceUsageExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(RU_EXPORT_DATASETS).default("meter_snapshot"),
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
    scopeMode: z.enum(RU_EXPORT_SCOPE_MODES).default("all"),
    datePreset: z.enum(RU_EXPORT_DATE_PRESETS).default("30d"),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    metricKey: z.string().trim().max(120).optional(),
    q: z.string().trim().max(200).optional(),
    columns: z.array(z.enum(RU_EXPORT_COLUMNS)).min(1).max(30).optional(),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(RU_EXPORT_DELIVERY).default("download"),
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

export type CreateResourceUsageExportBody = z.output<typeof createResourceUsageExportBodySchema>;

const exportResponses = reportExportResponseSchemas(
  ruExportHistoryItemSchema,
  ruExportScheduleItemSchema,
);

export const createResourceUsageExportResponseSchema = exportResponses.create;
export const resourceUsageExportRunDetailResponseSchema = exportResponses.runDetail;
export const retryResourceUsageExportResponseSchema = exportResponses.retry;
export const updateResourceUsageExportScheduleResponseSchema = exportResponses.updateSchedule;
