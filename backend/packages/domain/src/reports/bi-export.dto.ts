import { z } from "zod";
import { JOB_STATUSES } from "./reports.contract";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    r2_key: z.never().optional(),
    r2_object_key: z.never().optional(),
  })
  .loose();

export const BI_EXPORT_FORMATS = ["csv", "jsonl"] as const;

export type BiExportFormat = (typeof BI_EXPORT_FORMATS)[number];

export const createBiExportBodySchema = rejectClientTenantFields
  .extend({
    datasetKey: z.string().min(1),
    format: z.enum(BI_EXPORT_FORMATS).default("csv"),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const biExportListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const biExportParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const biExportJobDtoSchema = z
  .object({
    id: z.uuid(),
    datasetKey: z.string(),
    format: z.enum(BI_EXPORT_FORMATS),
    status: z.enum(JOB_STATUSES),
    params: z.record(z.string(), z.unknown()),
    requestedByMembershipId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    errorCode: z.string().nullable(),
    download: z
      .object({
        url: z.url(),
        expiresAt: z.iso.datetime(),
      })
      .nullable(),
  })
  .strict();

export const createBiExportResponseSchema = z.object({
  data: biExportJobDtoSchema.omit({ download: true }),
});

export const biExportListResponseSchema = z.object({
  data: z.object({
    items: z.array(biExportJobDtoSchema.omit({ download: true })),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const biExportDetailResponseSchema = z.object({
  data: biExportJobDtoSchema,
});

export type CreateBiExportBody = z.output<typeof createBiExportBodySchema>;
export type BiExportListQuery = z.output<typeof biExportListQuerySchema>;
