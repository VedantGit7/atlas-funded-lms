import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const DEVICE_EXPORT_WINDOWS = ["24h", "7d", "30d", "all"] as const;
export const DEVICE_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const DEVICE_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const DEVICE_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;

export const DEVICE_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner name", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: false, defaultSelected: true },
  { key: "membership_id", label: "Membership ID", sensitive: false, defaultSelected: true },
  { key: "device_count", label: "Device count", sensitive: false, defaultSelected: false },
  { key: "id", label: "Device IDs", sensitive: false, defaultSelected: false },
  { key: "platform", label: "Platform", sensitive: false, defaultSelected: false },
  { key: "user_agent", label: "Browser / OS", sensitive: false, defaultSelected: false },
  { key: "ip_address", label: "IP", sensitive: true, defaultSelected: false },
  { key: "device_fingerprint", label: "Fingerprint", sensitive: true, defaultSelected: false },
  { key: "created_at", label: "First seen", sensitive: false, defaultSelected: false },
  { key: "last_seen_at", label: "Last seen", sensitive: false, defaultSelected: false },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "flags", label: "Flags", sensitive: false, defaultSelected: true },
] as const;

export const deviceExportColumnKeySchema = z.enum([
  "learner_name",
  "email",
  "membership_id",
  "device_count",
  "id",
  "platform",
  "user_agent",
  "ip_address",
  "device_fingerprint",
  "created_at",
  "last_seen_at",
  "status",
  "flags",
]);

export const deviceExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    downloadAvailable: z.boolean(),
  })
  .strict();

export const deviceExportScheduleItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
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

export const activeDevicesExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(deviceExportHistoryItemSchema),
    schedules: z.array(deviceExportScheduleItemSchema),
    columns: z.array(
      z
        .object({
          key: deviceExportColumnKeySchema,
          label: z.string(),
          sensitive: z.boolean(),
          defaultSelected: z.boolean(),
        })
        .strict(),
    ),
    capabilities: z.object({
      formats: z.array(z.enum(DEVICE_EXPORT_FORMATS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      geoColumnsAvailable: z.literal(false),
      note: z.string(),
    }),
  }),
});

export const createActiveDevicesExportBodySchema = rejectClientTenantFields
  .extend({
    columns: z.array(deviceExportColumnKeySchema).min(1).max(20),
    format: z.enum(DEVICE_EXPORT_FORMATS).default("csv"),
    window: z.enum(DEVICE_EXPORT_WINDOWS).default("7d"),
    overLimitOnly: z.boolean().default(false),
    platform: z.string().trim().max(64).optional(),
    useCurrentFilters: z.boolean().default(true),
    delivery: z.enum(DEVICE_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(DEVICE_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateActiveDevicesExportBody = z.output<typeof createActiveDevicesExportBodySchema>;

export const createActiveDevicesExportResponseSchema = z.object({
  data: z.object({
    run: deviceExportHistoryItemSchema,
    schedule: deviceExportScheduleItemSchema.nullable(),
  }),
});

export const deviceExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const deviceExportRunDetailResponseSchema = z.object({
  data: deviceExportHistoryItemSchema,
});

export const retryActiveDevicesExportResponseSchema = z.object({
  data: deviceExportHistoryItemSchema,
});

export const deviceExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateDeviceExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateDeviceExportScheduleResponseSchema = z.object({
  data: deviceExportScheduleItemSchema,
});

export const deleteDeviceExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
