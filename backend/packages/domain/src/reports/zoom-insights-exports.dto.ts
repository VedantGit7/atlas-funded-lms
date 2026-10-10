import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { zoomConnectionMetaSchema } from "./zoom-insights-roster.dto";
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

export const ZOOM_EXPORT_DATASETS = [
  "meetings",
  "participants",
  "unmatched",
  "connection",
] as const;

export const ZOOM_EXPORT_DELIVERY = ["download", "email_me"] as const;
export const ZOOM_EXPORT_DATE_PRESETS = ["7d", "30d", "90d", "custom"] as const;

export const zoomExportHistoryItemSchema = z
  .object({
    ...exportRunFileFields,
    ...exportDatasetFields(ZOOM_EXPORT_DATASETS),
    ...exportRunScopeFields,
    requestedByLabel: z.string(),
    ...exportRunStateFields,
  })
  .strict();

export const zoomExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    ...exportDatasetFields(ZOOM_EXPORT_DATASETS),
    ...exportScheduleTimingFields,
    ...exportScheduleDeliveryField,
  })
  .strict();

export const zoomInsightsExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(zoomExportHistoryItemSchema),
    schedules: z.array(zoomExportScheduleItemSchema),
    connection: zoomConnectionMetaSchema,
    capabilities: z.object({
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
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
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
    datePreset: z.enum(ZOOM_EXPORT_DATE_PRESETS).default("30d"),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    allMeetingsInRange: z.boolean().default(true),
    meetingId: z.uuid().optional(),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(ZOOM_EXPORT_DELIVERY).default("download"),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(REPORT_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    recipients: z.array(z.email()).max(20).optional(),
  })
  .strict();

export type CreateZoomExportBody = z.output<typeof createZoomExportBodySchema>;

const exportResponses = reportExportResponseSchemas(
  zoomExportHistoryItemSchema,
  zoomExportScheduleItemSchema,
);

export const createZoomExportResponseSchema = exportResponses.create;
export const zoomExportRunDetailResponseSchema = exportResponses.runDetail;
export const retryZoomExportResponseSchema = exportResponses.retry;
export const updateZoomExportScheduleResponseSchema = exportResponses.updateSchedule;
