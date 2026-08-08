import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const BATCH_EXPORT_DATASETS = [
  "batch_summary",
  "batch_learners",
  "live_attendance",
  "exams",
  "content",
] as const;

export const BATCH_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const BATCH_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const BATCH_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const BATCH_EXPORT_GROUPING = ["none", "batch", "course", "health"] as const;

export const BATCH_SUMMARY_EXPORT_COLUMNS = [
  { key: "batch_key", label: "Batch key", sensitive: false, defaultSelected: true },
  { key: "batch_name", label: "Batch name", sensitive: false, defaultSelected: true },
  { key: "batch_status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "course_title", label: "Course", sensitive: false, defaultSelected: true },
  { key: "starts_at", label: "Starts", sensitive: false, defaultSelected: true },
  { key: "ends_at", label: "Ends", sensitive: false, defaultSelected: true },
] as const;

export const BATCH_LEARNERS_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "activity_at", label: "Last activity", sensitive: false, defaultSelected: true },
  { key: "batch_name", label: "Batch", sensitive: false, defaultSelected: true },
  { key: "batch_key", label: "Batch key", sensitive: false, defaultSelected: false },
  { key: "course_title", label: "Course", sensitive: false, defaultSelected: false },
  { key: "joined_at", label: "Joined on", sensitive: false, defaultSelected: true },
  { key: "membership_id", label: "Membership ID", sensitive: false, defaultSelected: false },
] as const;

export const batchExportColumnKeySchema = z.string().min(1).max(64);

export const batchExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(BATCH_EXPORT_DATASETS),
    datasetLabel: z.string(),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
    requestedByLabel: z.string(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    expired: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    downloadAvailable: z.boolean(),
    columns: z.array(z.string()),
  })
  .strict();

export const batchExportScheduleItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    formats: z.array(z.enum(REPORT_FORMATS)),
    isActive: z.boolean(),
    nextRunAt: z.string().datetime(),
    nextRunLabel: z.string(),
    recipients: z.array(z.string()),
    webhookLabel: z.string().nullable(),
    delivery: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const batchExportColumnSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    sensitive: z.boolean(),
    defaultSelected: z.boolean(),
  })
  .strict();

export const batchesExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(batchExportHistoryItemSchema),
    schedules: z.array(batchExportScheduleItemSchema),
    summaryColumns: z.array(batchExportColumnSchema),
    learnerColumns: z.array(batchExportColumnSchema),
    capabilities: z.object({
      formats: z.array(z.enum(BATCH_EXPORT_FORMATS)),
      datasets: z.array(z.enum(BATCH_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createBatchExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(BATCH_EXPORT_DATASETS).default("batch_learners"),
    columns: z.array(batchExportColumnKeySchema).min(1).max(30),
    format: z.enum(BATCH_EXPORT_FORMATS).default("csv"),
    batchIds: z.array(z.string().uuid()).max(50).optional(),
    allActiveBatches: z.boolean().default(false),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
    grouping: z.enum(BATCH_EXPORT_GROUPING).default("none"),
    includeSubtotals: z.boolean().default(false),
    useCurrentFilters: z.boolean().default(true),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(BATCH_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(BATCH_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateBatchExportBody = z.output<typeof createBatchExportBodySchema>;

export const createBatchExportResponseSchema = z.object({
  data: z.object({
    run: batchExportHistoryItemSchema,
    schedule: batchExportScheduleItemSchema.nullable(),
  }),
});

export const batchExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const batchExportRunDetailResponseSchema = z.object({
  data: batchExportHistoryItemSchema,
});

export const retryBatchExportResponseSchema = z.object({
  data: batchExportHistoryItemSchema,
});

export const batchExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateBatchExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateBatchExportScheduleResponseSchema = z.object({
  data: batchExportScheduleItemSchema,
});

export const deleteBatchExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
