import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const CUSTOM_FIELD_EXPORT_DATASETS = [
  "learner_roster",
  "field_coverage",
  "segment_members",
] as const;

export const CUSTOM_FIELD_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const CUSTOM_FIELD_EXPORT_DELIVERY = [
  "download",
  "email_me",
  "recipients",
] as const;
export const CUSTOM_FIELD_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const CUSTOM_FIELD_EXPORT_EMPTY_VALUES = ["blank", "emdash"] as const;

export const LEARNER_CORE_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Full name", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "email", label: "Email address", sensitive: true, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "enrollment_count", label: "Enrolments", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "total_spent_cents", label: "Total spent", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "last_active_at", label: "Last active", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
  { key: "signed_up_at", label: "Signed up", sensitive: false, defaultSelected: true, group: "learner" as const, typeBadge: null },
] as const;

export const customFieldExportColumnKeySchema = z.string().min(1).max(96);

export const customFieldExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(CUSTOM_FIELD_EXPORT_DATASETS),
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

export const customFieldExportScheduleItemSchema = z
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

export const customFieldExportColumnSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    sensitive: z.boolean(),
    defaultSelected: z.boolean(),
    group: z.enum(["learner", "custom"]),
    typeBadge: z.string().nullable(),
    fieldType: z.string().nullable(),
  })
  .strict();

export const customFieldExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(customFieldExportHistoryItemSchema),
    schedules: z.array(customFieldExportScheduleItemSchema),
    learnerColumns: z.array(customFieldExportColumnSchema),
    customFieldColumns: z.array(customFieldExportColumnSchema),
    capabilities: z.object({
      formats: z.array(z.enum(CUSTOM_FIELD_EXPORT_FORMATS)),
      datasets: z.array(z.enum(CUSTOM_FIELD_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createCustomFieldExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(CUSTOM_FIELD_EXPORT_DATASETS).default("learner_roster"),
    columns: z.array(customFieldExportColumnKeySchema).min(1).max(80),
    format: z.enum(CUSTOM_FIELD_EXPORT_FORMATS).default("csv"),
    emptyValueMode: z.enum(CUSTOM_FIELD_EXPORT_EMPTY_VALUES).default("blank"),
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
    segmentId: z.string().uuid().optional(),
    segmentName: z.string().trim().max(160).optional(),
    useCurrentFilters: z.boolean().default(true),
    delivery: z.enum(CUSTOM_FIELD_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(CUSTOM_FIELD_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateCustomFieldExportBody = z.output<typeof createCustomFieldExportBodySchema>;

export const createCustomFieldExportResponseSchema = z.object({
  data: z.object({
    run: customFieldExportHistoryItemSchema,
    schedule: customFieldExportScheduleItemSchema.nullable(),
  }),
});

export const customFieldExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const customFieldExportRunDetailResponseSchema = z.object({
  data: customFieldExportHistoryItemSchema,
});

export const retryCustomFieldExportResponseSchema = z.object({
  data: customFieldExportHistoryItemSchema,
});

export const customFieldExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateCustomFieldExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateCustomFieldExportScheduleResponseSchema = z.object({
  data: customFieldExportScheduleItemSchema,
});

export const deleteCustomFieldExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
