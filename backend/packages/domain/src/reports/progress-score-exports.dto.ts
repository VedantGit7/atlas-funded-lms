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

export const PROGRESS_SCORE_EXPORT_DATASETS = [
  "progress",
  "scores",
  "attempts",
  "item_analysis",
] as const;

export const PROGRESS_SCORE_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
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
    ...exportRunFileFields,
    ...exportDatasetFields(PROGRESS_SCORE_EXPORT_DATASETS),
    ...exportRunScopeFields,
    ...exportRunStateFields,
    columns: z.array(z.string()),
  })
  .strict();

export const progressScoreExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    ...exportScheduleTimingFields,
    webhookLabel: z.string().nullable(),
    ...exportScheduleDeliveryField,
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
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
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
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
    productType: z.enum(PROGRESS_SCORE_EXPORT_PRODUCT_TYPES).optional(),
    productId: z.uuid().optional(),
    courseId: z.uuid().optional(),
    assessmentId: z.uuid().optional(),
    dateFrom: z.iso.datetime().optional(),
    dateTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    enrolledType: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    resultStatus: z.enum(["pass", "fail", "pending", "in_progress"]).optional(),
    useCurrentFilters: z.boolean().default(true),
    delivery: z.enum(PROGRESS_SCORE_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.email()).max(20).optional(),
    webhookUrl: z.url().max(500).nullable().optional(),
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

export type CreateProgressScoreExportBody = z.output<typeof createProgressScoreExportBodySchema>;

const exportResponses = reportExportResponseSchemas(
  progressScoreExportHistoryItemSchema,
  progressScoreExportScheduleItemSchema,
);

export const createProgressScoreExportResponseSchema = exportResponses.create;
export const progressScoreExportRunDetailResponseSchema = exportResponses.runDetail;
export const retryProgressScoreExportResponseSchema = exportResponses.retry;
export const updateProgressScoreExportScheduleResponseSchema = exportResponses.updateSchedule;
