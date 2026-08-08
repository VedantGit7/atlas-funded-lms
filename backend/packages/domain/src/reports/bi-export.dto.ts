import { z } from "zod";
import { JOB_STATUSES } from "./reports.contract";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    r2_key: z.never().optional(),
    r2_object_key: z.never().optional(),
  })
  .passthrough();

export const BI_EXPORT_FORMATS = ["csv", "jsonl"] as const;

export type BiExportFormat = (typeof BI_EXPORT_FORMATS)[number];

export const createBiExportBodySchema = rejectClientTenantFields
  .extend({
    datasetKey: z.string().min(1),
    format: z.enum(BI_EXPORT_FORMATS).default("csv"),
    params: z.record(z.unknown()).optional(),
  })
  .strict();

export const biExportListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const biExportParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const biExportJobDtoSchema = z
  .object({
    id: z.string().uuid(),
    datasetKey: z.string(),
    format: z.enum(BI_EXPORT_FORMATS),
    status: z.enum(JOB_STATUSES),
    params: z.record(z.unknown()),
    requestedByMembershipId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    errorCode: z.string().nullable(),
    download: z
      .object({
        url: z.string().url(),
        expiresAt: z.string().datetime(),
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
      nextCursor: z.string().uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const biExportDetailResponseSchema = z.object({
  data: biExportJobDtoSchema,
});

export type CreateBiExportBody = z.output<typeof createBiExportBodySchema>;
export type BiExportListQuery = z.output<typeof biExportListQuerySchema>;
