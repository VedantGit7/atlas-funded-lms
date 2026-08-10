import { z } from "zod";
import { JOB_STATUSES, REPORT_FORMATS } from "./reports.contract";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const EXPORT_PIPELINE_STAGES = [
  "queued",
  "started",
  "query",
  "serialize",
  "upload",
  "delivered",
] as const;

export type ExportPipelineStageKey = (typeof EXPORT_PIPELINE_STAGES)[number];

export const exportRunDetailParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const exportRunDetailQuerySchema = rejectClientTenantFields
  .extend({
    sourceType: z.enum(["report_run", "export_job"]).optional(),
  })
  .strict();

export type ExportRunDetailQuery = z.output<typeof exportRunDetailQuerySchema>;

const pipelineStageSchema = z
  .object({
    key: z.enum(EXPORT_PIPELINE_STAGES),
    label: z.string(),
    state: z.enum(["complete", "current", "failed", "pending", "skipped"]),
    at: z.string().datetime().nullable(),
  })
  .strict();

const accessLogEntrySchema = z
  .object({
    id: z.string(),
    actorName: z.string(),
    actorEmail: z.string().nullable(),
    action: z.enum(["downloaded", "link_opened", "delivered_email", "initiated", "completed"]),
    ipAddress: z.string().nullable(),
    at: z.string().datetime(),
  })
  .strict();

export const exportRunDetailSchema = z
  .object({
    sourceType: z.enum(["report_run", "export_job"]),
    id: z.string().uuid(),
    fileName: z.string(),
    definitionKey: z.string().nullable(),
    definitionTitle: z.string().nullable(),
    status: z.enum(JOB_STATUSES),
    format: z.string().nullable(),
    params: z.record(z.unknown()),
    filterChips: z.array(z.string()),
    columnChips: z.array(z.string()),
    columnsTotal: z.number().int().nonnegative(),
    sortLabel: z.string().nullable(),
    rowLimitLabel: z.string().nullable(),
    delivery: z
      .object({
        kind: z.enum(["download_only", "email", "webhook", "storage"]),
        label: z.string(),
        recipients: z.array(z.string()),
        status: z.string().nullable(),
        deliveredAt: z.string().datetime().nullable(),
        error: z.string().nullable(),
      })
      .strict(),
    rowCount: z.number().int().nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    estimatedSizeLabel: z.string().nullable(),
    containsPersonalData: z.boolean(),
    requestedByName: z.string().nullable(),
    requestedByEmail: z.string().nullable(),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    failedStage: z.enum(EXPORT_PIPELINE_STAGES).nullable(),
    failureHint: z.string().nullable(),
    pipeline: z.array(pipelineStageSchema),
    hasFile: z.boolean(),
    canDownload: z.boolean(),
    canDeleteFile: z.boolean(),
    canCancel: z.boolean(),
    canRetry: z.boolean(),
    download: z
      .object({
        url: z.string().url(),
        expiresAt: z.string().datetime(),
      })
      .nullable(),
    accessLog: z.array(accessLogEntrySchema),
    accessLogAvailable: z.boolean(),
  })
  .strict();

export const exportRunDetailResponseSchema = z.object({
  data: exportRunDetailSchema,
});

export const deleteExportRunFileResponseSchema = z.object({
  data: z
    .object({
      id: z.string().uuid(),
      sourceType: z.enum(["report_run", "export_job"]),
      deleted: z.literal(true),
      hasFile: z.literal(false),
    })
    .strict(),
});

export const cancelExportRunResponseSchema = z.object({
  data: z
    .object({
      id: z.string().uuid(),
      sourceType: z.enum(["report_run", "export_job"]),
      status: z.literal("CANCELLED"),
    })
    .strict(),
});

export const retryExportRunResponseSchema = z.object({
  data: z
    .object({
      id: z.string().uuid(),
      sourceType: z.enum(["report_run", "export_job"]),
      status: z.enum(JOB_STATUSES),
    })
    .strict(),
});

export const exportRunActionBodySchema = rejectClientTenantFields
  .extend({
    sourceType: z.enum(["report_run", "export_job"]).optional(),
  })
  .strict();

export type ExportRunActionBody = z.output<typeof exportRunActionBodySchema>;

export { REPORT_FORMATS };
