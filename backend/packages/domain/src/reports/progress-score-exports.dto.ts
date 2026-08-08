import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const PROGRESS_SCORE_EXPORT_DATASETS = [
  "progress",
  "scores",
  "attempts",
  "item_analysis",
] as const;

export const PROGRESS_SCORE_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const PROGRESS_SCORE_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const PROGRESS_SCORE_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;

export const PROGRESS_SCORE_EXPORT_PRODUCT_TYPES = [
  "course",
  "test_series",
  "bundle",
  "subscription",
  "mock_test",
] as const;

export const PROGRESS_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "completion_pct", label: "Completion %", sensitive: false, defaultSelected: true },
  { key: "completed_lessons", label: "Completed", sensitive: false, defaultSelected: true },
  { key: "total_lessons", label: "Total", sensitive: false, defaultSelected: true },
  { key: "enrolled_type", label: "Enrolment type", sensitive: false, defaultSelected: true },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "enrolled_at", label: "Enrolled on", sensitive: false, defaultSelected: true },
  { key: "expires_at", label: "Expiry date", sensitive: false, defaultSelected: true },
] as const;

export const SCORE_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "result_status", label: "Result", sensitive: false, defaultSelected: true },
  { key: "attempt_count", label: "Attempts", sensitive: false, defaultSelected: true },
  { key: "score_pct", label: "Score", sensitive: false, defaultSelected: true },
  { key: "answered_count", label: "Answered", sensitive: false, defaultSelected: true },
  { key: "submitted_at", label: "Submitted on", sensitive: false, defaultSelected: true },
] as const;

export const progressScoreExportColumnKeySchema = z.string().min(1).max(64);

export const progressScoreExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(PROGRESS_SCORE_EXPORT_DATASETS),
    datasetLabel: z.string(),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
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

export const progressScoreExportScheduleItemSchema = z
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

export const progressScoreExportColumnSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    sensitive: z.boolean(),
    defaultSelected: z.boolean(),
  })
  .strict();

export const progressScoreExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(progressScoreExportHistoryItemSchema),
    schedules: z.array(progressScoreExportScheduleItemSchema),
    progressColumns: z.array(progressScoreExportColumnSchema),
    scoreColumns: z.array(progressScoreExportColumnSchema),
    capabilities: z.object({
      formats: z.array(z.enum(PROGRESS_SCORE_EXPORT_FORMATS)),
      datasets: z.array(z.enum(PROGRESS_SCORE_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createProgressScoreExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(PROGRESS_SCORE_EXPORT_DATASETS).default("progress"),
    columns: z.array(progressScoreExportColumnKeySchema).min(1).max(30),
    format: z.enum(PROGRESS_SCORE_EXPORT_FORMATS).default("csv"),
    productType: z.enum(PROGRESS_SCORE_EXPORT_PRODUCT_TYPES).optional(),
    productId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    assessmentId: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    useCurrentFilters: z.boolean().default(true),
    delivery: z.enum(PROGRESS_SCORE_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(PROGRESS_SCORE_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateProgressScoreExportBody = z.output<typeof createProgressScoreExportBodySchema>;

export const createProgressScoreExportResponseSchema = z.object({
  data: z.object({
    run: progressScoreExportHistoryItemSchema,
    schedule: progressScoreExportScheduleItemSchema.nullable(),
  }),
});

export const progressScoreExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const progressScoreExportRunDetailResponseSchema = z.object({
  data: progressScoreExportHistoryItemSchema,
});

export const retryProgressScoreExportResponseSchema = z.object({
  data: progressScoreExportHistoryItemSchema,
});

export const progressScoreExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateProgressScoreExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateProgressScoreExportScheduleResponseSchema = z.object({
  data: progressScoreExportScheduleItemSchema,
});

export const deleteProgressScoreExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
