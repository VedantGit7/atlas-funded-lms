import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const LCA_EXPORT_DATASETS = [
  "sessions",
  "attendees",
  "learner_summary",
  "series_rollup",
] as const;

export const LCA_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const LCA_EXPORT_DELIVERY = ["download", "email_me", "send_recipients"] as const;
export const LCA_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const LCA_EXPORT_DATE_PRESETS = ["7d", "30d", "90d", "custom"] as const;
export const LCA_EXPORT_REGISTRATION_MODES = ["include_never_joined", "attendees_only"] as const;
export const LCA_EXPORT_SCOPE_MODES = ["date_range", "course", "batch", "sessions"] as const;

export const LCA_EXPORT_COLUMNS = [
  "learner_name",
  "email",
  "status",
  "joined_at",
  "left_at",
  "duration_seconds",
  "coverage_pct",
  "batch_name",
  "registered_at",
  "session_title",
  "course_title",
] as const;

export const lcaExportHistoryItemSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(LCA_EXPORT_DATASETS),
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

export const lcaExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    dataset: z.enum(LCA_EXPORT_DATASETS),
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

export const liveClassAttendanceExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(lcaExportHistoryItemSchema),
    schedules: z.array(lcaExportScheduleItemSchema),
    capabilities: z.object({
      formats: z.array(z.enum(LCA_EXPORT_FORMATS)),
      datasets: z.array(z.enum(LCA_EXPORT_DATASETS)),
      columns: z.array(z.enum(LCA_EXPORT_COLUMNS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      note: z.string(),
    }),
    estimates: z.object({
      includeNeverJoinedRows: z.number().int().nonnegative().nullable(),
      attendeesOnlyRows: z.number().int().nonnegative().nullable(),
    }),
  }),
});

export const createLiveClassAttendanceExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(LCA_EXPORT_DATASETS).default("attendees"),
    format: z.enum(LCA_EXPORT_FORMATS).default("csv"),
    scopeMode: z.enum(LCA_EXPORT_SCOPE_MODES).default("date_range"),
    datePreset: z.enum(LCA_EXPORT_DATE_PRESETS).default("30d"),
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    sessionIds: z.array(z.uuid()).max(200).optional(),
    columns: z.array(z.enum(LCA_EXPORT_COLUMNS)).min(1).max(30).optional(),
    registrationMode: z.enum(LCA_EXPORT_REGISTRATION_MODES).default("include_never_joined"),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(LCA_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.email()).max(20).optional(),
    webhookUrl: z.url().max(500).optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(LCA_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateLiveClassAttendanceExportBody = z.output<
  typeof createLiveClassAttendanceExportBodySchema
>;

export const createLiveClassAttendanceExportResponseSchema = z.object({
  data: z.object({
    run: lcaExportHistoryItemSchema,
    schedule: lcaExportScheduleItemSchema.nullable(),
  }),
});

export const liveClassAttendanceExportRunParamsSchema = z
  .object({
    runId: z.uuid(),
  })
  .strict();

export const liveClassAttendanceExportRunDetailResponseSchema = z.object({
  data: lcaExportHistoryItemSchema,
});

export const retryLiveClassAttendanceExportResponseSchema = z.object({
  data: lcaExportHistoryItemSchema,
});

export const liveClassAttendanceExportScheduleParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const updateLiveClassAttendanceExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateLiveClassAttendanceExportScheduleResponseSchema = z.object({
  data: lcaExportScheduleItemSchema,
});

export const deleteLiveClassAttendanceExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});
