import { z } from "zod";
import { JOB_STATUSES, REPORT_FORMATS } from "./reports.contract";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { scheduleDestinationChipSchema, SCHEDULE_DESTINATION_KINDS } from "./schedules-roster.dto";

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const scheduleDetailParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const scheduleDetailQuerySchema = rejectClientTenantFields
  .extend({
    runsPage: z.coerce.number().int().min(1).max(1000).default(1),
    runsLimit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type ScheduleDetailQuery = z.output<typeof scheduleDetailQuerySchema>;

export const scheduleDetailConfigSchema = z
  .object({
    reportTitle: z.string(),
    definitionKey: z.string(),
    filterChips: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
      }),
    ),
    columns: z.array(z.string()),
    columnCount: z.number().int().nonnegative(),
    format: z.enum(REPORT_FORMATS),
    formatOptionsLabel: z.string().nullable(),
    rowLimit: z.number().int().nullable(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    retentionDays: z.number().int().nullable(),
    destinations: z.array(scheduleDestinationChipSchema),
    isExternal: z.boolean(),
    externalWarning: z.string().nullable(),
    editBuilderHref: z.string(),
  })
  .strict();

export const scheduleDetailStatsSchema = z
  .object({
    nextRunAt: z.iso.datetime().nullable(),
    totalRuns: z.number().int().nonnegative(),
    succeededRuns: z.number().int().nonnegative(),
    failedRuns: z.number().int().nonnegative(),
    successRatePercent: z.number().min(0).max(100).nullable(),
    avgDurationMs: z.number().int().nonnegative().nullable(),
    avgRowCount: z.number().int().nonnegative().nullable(),
    rowSparkline: z.array(z.number().int().nonnegative()),
  })
  .strict();

export const scheduleDetailTroubleSchema = z
  .object({
    consecutiveFailures: z.number().int().positive(),
    lastErrorMessage: z.string(),
    failingSinceAt: z.iso.datetime().nullable(),
    failingRunId: z.uuid().nullable(),
    retriesRemainingBeforePause: z.number().int().nonnegative().nullable(),
  })
  .nullable();

export const scheduleDetailRunSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string().nullable(),
    status: z.enum(JOB_STATUSES),
    rowCount: z.number().int().nullable(),
    rowDelta: z.number().int().nullable(),
    durationMs: z.number().int().nullable(),
    durationLabel: z.string().nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    format: z.enum(REPORT_FORMATS).nullable(),
    hasFile: z.boolean(),
    canDownload: z.boolean(),
    deliveryKind: z.enum([...SCHEDULE_DESTINATION_KINDS, "unknown"]).nullable(),
    deliveryLabel: z.string().nullable(),
    deliveryStatus: z.enum(["succeeded", "failed", "pending", "skipped"]).nullable(),
    deliveryError: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })
  .strict();

export const scheduleDetailResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    name: z.string(),
    definitionKey: z.string(),
    definitionTitle: z.string(),
    isActive: z.boolean(),
    isFailing: z.boolean(),
    cadenceLabel: z.string(),
    primaryFormat: z.enum(REPORT_FORMATS),
    destinations: z.array(scheduleDestinationChipSchema),
    isExternal: z.boolean(),
    nextRunAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    ownerName: z.string().nullable(),
    stats: scheduleDetailStatsSchema,
    config: scheduleDetailConfigSchema,
    trouble: scheduleDetailTroubleSchema,
    runs: z.array(scheduleDetailRunSchema),
    runsPageInfo: pageInfoSchema,
  }),
});

export const duplicateScheduleResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
});

export { SCHEDULE_DESTINATION_KINDS };
