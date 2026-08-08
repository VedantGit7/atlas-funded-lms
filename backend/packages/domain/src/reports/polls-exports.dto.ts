import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const POLL_EXPORT_DATASETS = [
  "poll_summary",
  "option_tallies",
  "respondents",
  "non_respondents",
] as const;

export const POLL_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const POLL_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const POLL_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const POLL_EXPORT_GROUPING = ["none", "poll", "live_session", "option"] as const;

export const POLL_SUMMARY_EXPORT_COLUMNS = [
  { key: "poll_title", label: "Poll", sensitive: false, defaultSelected: true },
  { key: "live_session_title", label: "Session", sensitive: false, defaultSelected: true },
  { key: "poll_type", label: "Type", sensitive: false, defaultSelected: true },
  { key: "quiz_mode", label: "Quiz", sensitive: false, defaultSelected: true },
  { key: "anonymous_vote", label: "Anonymous", sensitive: false, defaultSelected: true },
  { key: "response_count", label: "Responses", sensitive: false, defaultSelected: true },
  { key: "participation_pct", label: "Participation %", sensitive: false, defaultSelected: true },
  { key: "created_at", label: "Created", sensitive: false, defaultSelected: true },
] as const;

export const POLL_OPTION_TALLIES_EXPORT_COLUMNS = [
  { key: "poll_title", label: "Poll", sensitive: false, defaultSelected: true },
  { key: "option_label", label: "Option", sensitive: false, defaultSelected: true },
  { key: "is_correct", label: "Correct", sensitive: false, defaultSelected: true },
  { key: "count", label: "Votes", sensitive: false, defaultSelected: true },
  { key: "percent", label: "Share %", sensitive: false, defaultSelected: true },
  { key: "sort_order", label: "Order", sensitive: false, defaultSelected: false },
] as const;

export const POLL_RESPONDENTS_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "option_label", label: "Option", sensitive: false, defaultSelected: true },
  { key: "is_correct", label: "Correct", sensitive: false, defaultSelected: true },
  { key: "responded_at", label: "Responded on", sensitive: false, defaultSelected: true },
] as const;

export const POLL_NON_RESPONDENTS_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "presence", label: "Presence", sensitive: false, defaultSelected: true },
  { key: "poll_title", label: "Poll", sensitive: false, defaultSelected: true },
] as const;

export const pollExportColumnKeySchema = z.string().min(1).max(64);

export const pollExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(POLL_EXPORT_DATASETS),
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
    anonymousExcludedCount: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const pollExportScheduleItemSchema = z
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

export const pollExportColumnSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    sensitive: z.boolean(),
    defaultSelected: z.boolean(),
  })
  .strict();

export const pollsExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(pollExportHistoryItemSchema),
    schedules: z.array(pollExportScheduleItemSchema),
    summaryColumns: z.array(pollExportColumnSchema),
    optionTalliesColumns: z.array(pollExportColumnSchema),
    respondentsColumns: z.array(pollExportColumnSchema),
    nonRespondentsColumns: z.array(pollExportColumnSchema),
    capabilities: z.object({
      formats: z.array(z.enum(POLL_EXPORT_FORMATS)),
      datasets: z.array(z.enum(POLL_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createPollExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(POLL_EXPORT_DATASETS).default("respondents"),
    columns: z.array(pollExportColumnKeySchema).min(1).max(30),
    format: z.enum(POLL_EXPORT_FORMATS).default("csv"),
    pollIds: z.array(z.string().uuid()).max(50).optional(),
    liveSessionId: z.string().uuid().optional(),
    allPollsInSession: z.boolean().default(false),
    allPollsInRange: z.boolean().default(false),
    respondedFrom: z.string().datetime().optional(),
    respondedTo: z.string().datetime().optional(),
    grouping: z.enum(POLL_EXPORT_GROUPING).default("none"),
    includeSubtotals: z.boolean().default(false),
    useCurrentFilters: z.boolean().default(true),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(POLL_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(POLL_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreatePollExportBody = z.output<typeof createPollExportBodySchema>;

export const createPollExportResponseSchema = z.object({
  data: z.object({
    run: pollExportHistoryItemSchema,
    schedule: pollExportScheduleItemSchema.nullable(),
  }),
});

export const pollExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const pollExportRunDetailResponseSchema = z.object({
  data: pollExportHistoryItemSchema,
});

export const retryPollExportResponseSchema = z.object({
  data: pollExportHistoryItemSchema,
});

export const pollExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updatePollExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updatePollExportScheduleResponseSchema = z.object({
  data: pollExportScheduleItemSchema,
});

export const deletePollExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
