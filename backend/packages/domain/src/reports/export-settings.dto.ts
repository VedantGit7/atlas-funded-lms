import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const FILE_RETENTION_UNITS = ["days", "hours"] as const;
export const RUN_RECORD_RETENTIONS = ["1y", "2y", "5y", "forever"] as const;
export const DOWNLOAD_ACCESS_POLICIES = [
  "anyone_who_can_run",
  "owners_only",
  "requester_only",
] as const;
export const PII_TREATMENTS = ["include", "mask", "exclude"] as const;
export const PII_DATA_TYPES = [
  "learner_name",
  "email",
  "phone",
  "billing_address",
  "tax_id",
  "ip_address",
  "device_fingerprint",
] as const;

export type PiiDataType = (typeof PII_DATA_TYPES)[number];
export type PiiTreatment = (typeof PII_TREATMENTS)[number];

export const personalDataTreatmentsSchema = z
  .object({
    learner_name: z.enum(PII_TREATMENTS),
    email: z.enum(PII_TREATMENTS),
    phone: z.enum(PII_TREATMENTS),
    billing_address: z.enum(PII_TREATMENTS),
    tax_id: z.enum(PII_TREATMENTS),
    ip_address: z.enum(PII_TREATMENTS),
    device_fingerprint: z.enum(PII_TREATMENTS),
  })
  .strict();

export const exportSettingsSchema = z
  .object({
    fileRetentionValue: z.number().int().min(1).max(3650),
    fileRetentionUnit: z.enum(FILE_RETENTION_UNITS),
    runRecordRetention: z.enum(RUN_RECORD_RETENTIONS),
    maxRowsPerExport: z.number().int().min(1000).max(10_000_000),
    maxConcurrentPerAdmin: z.number().int().min(1).max(20),
    runExportRoleKeys: z.array(z.string().trim().min(1).max(80)).max(50),
    downloadAccess: z.enum(DOWNLOAD_ACCESS_POLICIES),
    requireReasonForPii: z.boolean(),
    allowExternalDestinations: z.boolean(),
    watermarkExports: z.boolean(),
    personalDataTreatments: personalDataTreatmentsSchema,
  })
  .strict();

export type ExportSettings = z.output<typeof exportSettingsSchema>;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  fileRetentionValue: 7,
  fileRetentionUnit: "days",
  runRecordRetention: "2y",
  maxRowsPerExport: 1_000_000,
  maxConcurrentPerAdmin: 3,
  runExportRoleKeys: ["super_admin", "report_admin"],
  downloadAccess: "anyone_who_can_run",
  requireReasonForPii: false,
  allowExternalDestinations: true,
  watermarkExports: false,
  personalDataTreatments: {
    learner_name: "mask",
    email: "mask",
    phone: "include",
    billing_address: "include",
    tax_id: "include",
    ip_address: "exclude",
    device_fingerprint: "include",
  },
};

export const piiFieldMetaSchema = z
  .object({
    key: z.enum(PII_DATA_TYPES),
    label: z.string(),
    maskExample: z.string().nullable(),
    exposedByReports: z.array(z.string()),
  })
  .strict();

export const exportSettingsRoleSchema = z
  .object({
    key: z.string(),
    name: z.string(),
  })
  .strict();

export const exportSettingsStorageStatsSchema = z
  .object({
    filesStoredCount: z.number().int().nonnegative(),
    estimatedBytes: z.number().int().nonnegative(),
    expiringSoonCount: z.number().int().nonnegative(),
    expiredCount: z.number().int().nonnegative(),
    purgeFreesEstimatedBytes: z.number().int().nonnegative(),
  })
  .strict();

export const exportSettingsAuditEventSchema = z
  .object({
    id: z.uuid(),
    occurredAt: z.iso.datetime(),
    summary: z.string(),
    actorName: z.string().nullable(),
  })
  .strict();

export const exportSettingsResponseSchema = z.object({
  data: z.object({
    settings: exportSettingsSchema,
    storage: exportSettingsStorageStatsSchema,
    availableRoles: z.array(exportSettingsRoleSchema),
    externalDestinationCount: z.number().int().nonnegative(),
    personalDataFields: z.array(piiFieldMetaSchema),
    recentAudit: z.array(exportSettingsAuditEventSchema),
    updatedAt: z.iso.datetime().nullable(),
    updatedByName: z.string().nullable(),
  }),
});

export const updateExportSettingsBodySchema = rejectClientTenantFields
  .extend({
    settings: exportSettingsSchema,
    acknowledgeRetentionPurge: z.boolean().optional().default(false),
  })
  .strict();

export type UpdateExportSettingsBody = z.output<typeof updateExportSettingsBodySchema>;

export const updateExportSettingsResponseSchema = exportSettingsResponseSchema;

export const retentionImpactQuerySchema = rejectClientTenantFields
  .extend({
    fileRetentionValue: z.coerce.number().int().min(1).max(3650),
    fileRetentionUnit: z.enum(FILE_RETENTION_UNITS),
  })
  .strict();

export type RetentionImpactQuery = z.output<typeof retentionImpactQuerySchema>;

export const retentionImpactResponseSchema = z.object({
  data: z.object({
    filesDeletedImmediately: z.number().int().nonnegative(),
    estimatedBytesFreed: z.number().int().nonnegative(),
    currentRetentionLabel: z.string(),
    nextRetentionLabel: z.string(),
  }),
});

export const purgeExpiredBodySchema = rejectClientTenantFields.extend({}).strict();

export const purgeExpiredResponseSchema = z.object({
  data: z.object({
    queuedCount: z.number().int().nonnegative(),
    deletedCount: z.number().int().nonnegative(),
    estimatedBytesFreed: z.number().int().nonnegative(),
  }),
});
