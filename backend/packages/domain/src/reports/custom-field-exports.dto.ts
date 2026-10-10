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

export const CUSTOM_FIELD_EXPORT_DATASETS = [
  "learner_roster",
  "field_coverage",
  "segment_members",
] as const;

export const CUSTOM_FIELD_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const CUSTOM_FIELD_EXPORT_EMPTY_VALUES = ["blank", "emdash"] as const;

export const LEARNER_CORE_EXPORT_COLUMNS = [
  {
    key: "learner_name",
    label: "Full name",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "email",
    label: "Email address",
    sensitive: true,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "status",
    label: "Status",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "enrollment_count",
    label: "Enrolments",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "total_spent_cents",
    label: "Total spent",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "last_active_at",
    label: "Last active",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
  {
    key: "signed_up_at",
    label: "Signed up",
    sensitive: false,
    defaultSelected: true,
    group: "learner" as const,
    typeBadge: null,
  },
] as const;

export const customFieldExportColumnKeySchema = z.string().min(1).max(96);

export const customFieldExportHistoryItemSchema = z
  .object({
    ...exportRunFileFields,
    ...exportDatasetFields(CUSTOM_FIELD_EXPORT_DATASETS),
    ...exportRunScopeFields,
    ...exportRunStateFields,
    columns: z.array(z.string()),
  })
  .strict();

export const customFieldExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    ...exportScheduleTimingFields,
    webhookLabel: z.string().nullable(),
    ...exportScheduleDeliveryField,
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
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
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
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
    emptyValueMode: z.enum(CUSTOM_FIELD_EXPORT_EMPTY_VALUES).default("blank"),
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.iso.datetime().optional(),
    signedUpTo: z.iso.datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
    segmentId: z.uuid().optional(),
    segmentName: z.string().trim().max(160).optional(),
    useCurrentFilters: z.boolean().default(true),
    delivery: z.enum(CUSTOM_FIELD_EXPORT_DELIVERY).default("download"),
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

export type CreateCustomFieldExportBody = z.output<typeof createCustomFieldExportBodySchema>;

const exportResponses = reportExportResponseSchemas(
  customFieldExportHistoryItemSchema,
  customFieldExportScheduleItemSchema,
);

export const createCustomFieldExportResponseSchema = exportResponses.create;
export const customFieldExportRunDetailResponseSchema = exportResponses.runDetail;
export const retryCustomFieldExportResponseSchema = exportResponses.retry;
export const updateCustomFieldExportScheduleResponseSchema = exportResponses.updateSchedule;
