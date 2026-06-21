import { z } from "zod";

export const DATA_EXPORT_REQUESTED_EVENT = "data.export_requested" as const;
export const DATA_DELETION_REQUESTED_EVENT = "data.deletion_requested" as const;

export const DATA_EXPORT_REQUESTED_AUDIT = "data.export.requested" as const;
export const DATA_DELETION_REQUESTED_AUDIT = "data.deletion.requested" as const;
export const DATA_DELETION_PROCESSED_AUDIT = "data.deletion.processed" as const;

export const DATA_EXPORT_WORKER_DESTINATION = "data.export" as const;

export const exportScopeSchema = z
  .object({
    version: z.literal(1),
    domains: z.array(z.enum(["membership", "profile", "course", "enrollment"])),
  })
  .strict();

export const dataExportRequestedPayloadSchema = z
  .object({
    exportJobId: z.string().uuid(),
    requestedAt: z.string().datetime(),
    requestedByMembershipId: z.string().uuid(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type DataExportRequestedPayload = z.output<typeof dataExportRequestedPayloadSchema>;
