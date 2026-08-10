import { z } from "zod";
import { JOB_STATUSES, REPORT_FORMATS } from "./reports.contract";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const SCHEDULE_STATUS_FILTERS = ["enabled", "paused", "failing", "all"] as const;
export type ScheduleStatusFilter = (typeof SCHEDULE_STATUS_FILTERS)[number];

export const SCHEDULE_CADENCE_FILTERS = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "custom",
  "any",
] as const;
export type ScheduleCadenceFilter = (typeof SCHEDULE_CADENCE_FILTERS)[number];

export const SCHEDULE_DESTINATION_FILTERS = [
  "download",
  "email",
  "webhook",
  "storage",
  "any",
] as const;
export type ScheduleDestinationFilter = (typeof SCHEDULE_DESTINATION_FILTERS)[number];

export const SCHEDULE_SORTS = [
  "next_run_asc",
  "last_run_desc",
  "name_asc",
  "failures_desc",
] as const;
export type ScheduleSort = (typeof SCHEDULE_SORTS)[number];

export const SCHEDULE_DESTINATION_KINDS = ["download", "email", "webhook", "storage"] as const;
export type ScheduleDestinationKind = (typeof SCHEDULE_DESTINATION_KINDS)[number];

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const schedulesRosterListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    definitionKey: z.string().trim().min(1).max(120).optional(),
    status: z.enum(SCHEDULE_STATUS_FILTERS).optional().default("all"),
    cadence: z.enum(SCHEDULE_CADENCE_FILTERS).optional().default("any"),
    destination: z.enum(SCHEDULE_DESTINATION_FILTERS).optional().default("any"),
    ownerMembershipId: z.string().uuid().optional(),
    sort: z.enum(SCHEDULE_SORTS).optional().default("next_run_asc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type SchedulesRosterListQuery = z.output<typeof schedulesRosterListQuerySchema>;

export const scheduleDestinationChipSchema = z
  .object({
    kind: z.enum(SCHEDULE_DESTINATION_KINDS),
    label: z.string(),
    detail: z.string().nullable(),
  })
  .strict();

export const schedulesRosterItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    definitionKey: z.string(),
    definitionTitle: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    cadenceLabel: z.string(),
    cadenceKind: z.enum(["hourly", "daily", "weekly", "monthly", "custom"]),
    formats: z.array(z.enum(REPORT_FORMATS)),
    primaryFormat: z.enum(REPORT_FORMATS),
    destinations: z.array(scheduleDestinationChipSchema),
    isExternal: z.boolean(),
    isActive: z.boolean(),
    isFailing: z.boolean(),
    consecutiveFailures: z.number().int().nonnegative(),
    nextRunAt: z.string().datetime().nullable(),
    lastRunAt: z.string().datetime().nullable(),
    lastRunStatus: z.enum(JOB_STATUSES).nullable(),
    lastRunRowCount: z.number().int().nullable(),
    lastRunErrorMessage: z.string().nullable(),
    pastRunCount: z.number().int().nonnegative(),
    ownerMembershipId: z.string().uuid(),
    ownerName: z.string().nullable(),
    ownerInitials: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const schedulesRosterSummarySchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    enabledCount: z.number().int().nonnegative(),
    pausedCount: z.number().int().nonnegative(),
    runsThisMonth: z.number().int().nonnegative(),
    runsSucceededThisMonth: z.number().int().nonnegative(),
    runsFailedThisMonth: z.number().int().nonnegative(),
    nextRunAt: z.string().datetime().nullable(),
    nextScheduleName: z.string().nullable(),
    failingCount: z.number().int().nonnegative(),
    maxConsecutiveFailures: z.number().int().nonnegative(),
    externalDeliveryCount: z.number().int().nonnegative(),
  })
  .strict();

export const schedulesRosterListResponseSchema = z.object({
  data: z.object({
    items: z.array(schedulesRosterItemSchema),
    pageInfo: pageInfoSchema,
    summary: schedulesRosterSummarySchema,
  }),
});

export const schedulesRosterBulkBodySchema = rejectClientTenantFields
  .extend({
    action: z.enum(["pause", "enable", "delete", "run_now"]),
    ids: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

export type SchedulesRosterBulkBody = z.output<typeof schedulesRosterBulkBodySchema>;

export const schedulesRosterBulkResponseSchema = z.object({
  data: z.object({
    action: z.enum(["pause", "enable", "delete", "run_now"]),
    processed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    runIds: z.array(z.string().uuid()).optional(),
  }),
});

export const runScheduleNowResponseSchema = z.object({
  data: z.object({
    scheduleId: z.string().uuid(),
    runId: z.string().uuid(),
    status: z.enum(JOB_STATUSES),
  }),
});

export const scheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();
