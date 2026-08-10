import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";
import { zoomConnectionMetaSchema } from "./zoom-insights-roster.dto";

export const ZOOM_EXPORT_DATASETS = [
  "meetings",
  "participants",
  "unmatched",
  "connection",
] as const;

export const ZOOM_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const ZOOM_EXPORT_DELIVERY = ["download", "email_me"] as const;
export const ZOOM_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const ZOOM_EXPORT_DATE_PRESETS = ["7d", "30d", "90d", "custom"] as const;

export const zoomExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(ZOOM_EXPORT_DATASETS),
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
  })
  .strict();

export const zoomExportScheduleItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    dataset: z.enum(ZOOM_EXPORT_DATASETS),
    datasetLabel: z.string(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    formats: z.array(z.enum(REPORT_FORMATS)),
    isActive: z.boolean(),
    nextRunAt: z.string().datetime(),
    nextRunLabel: z.string(),
    recipients: z.array(z.string()),
    delivery: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const zoomInsightsExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(zoomExportHistoryItemSchema),
    schedules: z.array(zoomExportScheduleItemSchema),
    connection: zoomConnectionMetaSchema,
    capabilities: z.object({
      formats: z.array(z.enum(ZOOM_EXPORT_FORMATS)),
      datasets: z.array(z.enum(ZOOM_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createZoomExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(ZOOM_EXPORT_DATASETS).default("meetings"),
    format: z.enum(ZOOM_EXPORT_FORMATS).default("csv"),
    datePreset: z.enum(ZOOM_EXPORT_DATE_PRESETS).default("30d"),
    startedFrom: z.string().datetime().optional(),
    startedTo: z.string().datetime().optional(),
    allMeetingsInRange: z.boolean().default(true),
    meetingId: z.string().uuid().optional(),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(ZOOM_EXPORT_DELIVERY).default("download"),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(ZOOM_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    recipients: z.array(z.string().email()).max(20).optional(),
  })
  .strict();

export type CreateZoomExportBody = z.output<typeof createZoomExportBodySchema>;

export const createZoomExportResponseSchema = z.object({
  data: z.object({
    run: zoomExportHistoryItemSchema,
    schedule: zoomExportScheduleItemSchema.nullable(),
  }),
});

export const zoomExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const zoomExportRunDetailResponseSchema = z.object({
  data: zoomExportHistoryItemSchema,
});

export const retryZoomExportResponseSchema = z.object({
  data: zoomExportHistoryItemSchema,
});

export const zoomExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateZoomExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateZoomExportScheduleResponseSchema = z.object({
  data: zoomExportScheduleItemSchema,
});

export const deleteZoomExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
