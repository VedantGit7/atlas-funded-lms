import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const RU_EXPORT_DATASETS = [
  "meter_snapshot",
  "metric_history",
  "storage_breakdown",
  "inactive_learners",
  "dormant_content",
] as const;

export const RU_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const RU_EXPORT_DELIVERY = ["download", "email_me", "send_recipients"] as const;
export const RU_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
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
    id: z.uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(RU_EXPORT_DATASETS),
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

export const ruExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    dataset: z.enum(RU_EXPORT_DATASETS),
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

export const resourceUsageExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(ruExportHistoryItemSchema),
    schedules: z.array(ruExportScheduleItemSchema),
    capabilities: z.object({
      formats: z.array(z.enum(RU_EXPORT_FORMATS)),
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
    format: z.enum(RU_EXPORT_FORMATS).default("csv"),
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
    cadence: z.enum(RU_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateResourceUsageExportBody = z.output<typeof createResourceUsageExportBodySchema>;

export const createResourceUsageExportResponseSchema = z.object({
  data: z.object({
    run: ruExportHistoryItemSchema,
    schedule: ruExportScheduleItemSchema.nullable(),
  }),
});

export const resourceUsageExportRunParamsSchema = z
  .object({
    runId: z.uuid(),
  })
  .strict();

export const resourceUsageExportRunDetailResponseSchema = z.object({
  data: ruExportHistoryItemSchema,
});

export const retryResourceUsageExportResponseSchema = z.object({
  data: ruExportHistoryItemSchema,
});

export const resourceUsageExportScheduleParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const updateResourceUsageExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateResourceUsageExportScheduleResponseSchema = z.object({
  data: ruExportScheduleItemSchema,
});

export const deleteResourceUsageExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});
