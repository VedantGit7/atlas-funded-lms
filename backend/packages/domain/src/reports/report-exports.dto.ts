import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

/**
 * What every report's exports page shares in its requests and responses. A
 * report composes its history and schedule items from the field groups below,
 * adding its own datasets and columns, and builds its response schemas with
 * reportExportResponseSchemas.
 */

export const REPORT_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const REPORT_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;

export const reportExportRunParamsSchema = z
  .object({
    runId: z.uuid(),
  })
  .strict();

export const reportExportScheduleParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const updateReportExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const deleteReportExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});

/** A history row starts with the file it describes. */
export const exportRunFileFields = {
  id: z.uuid(),
  fileName: z.string(),
  format: z.enum(REPORT_FORMATS),
};

/** The dataset an export or schedule covers, for reports with more than one. */
export function exportDatasetFields<const TDataset extends readonly [string, ...string[]]>(
  datasets: TDataset,
) {
  return {
    dataset: z.enum(datasets),
    datasetLabel: z.string(),
  };
}

export const exportRunScopeFields = {
  scopeLabel: z.string(),
  rowCount: z.number().int().nullable(),
  sizeLabel: z.string().nullable(),
};

/** Where the run is and whether its file can still be downloaded. */
export const exportRunStateFields = {
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
};

/** When a schedule runs, in what formats, and who it is sent to. */
export const exportScheduleTimingFields = {
  cadenceLabel: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  formats: z.array(z.enum(REPORT_FORMATS)),
  isActive: z.boolean(),
  nextRunAt: z.iso.datetime(),
  nextRunLabel: z.string(),
  recipients: z.array(z.string()),
};

export const exportScheduleDeliveryField = {
  delivery: z.record(z.string(), z.unknown()).nullable(),
};

/** The responses that carry a report's history or schedule items. */
export function reportExportResponseSchemas<
  THistoryItem extends z.ZodType,
  TScheduleItem extends z.ZodType,
>(historyItem: THistoryItem, scheduleItem: TScheduleItem) {
  return {
    create: z.object({
      data: z.object({
        run: historyItem,
        schedule: scheduleItem.nullable(),
      }),
    }),
    runDetail: z.object({
      data: historyItem,
    }),
    retry: z.object({
      data: historyItem,
    }),
    updateSchedule: z.object({
      data: scheduleItem,
    }),
  };
}
