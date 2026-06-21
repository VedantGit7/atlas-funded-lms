import { z } from "zod";
import { JOB_STATUSES } from "./data-rights.contract";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
    r2_key: z.never().optional(),
    r2_object_key: z.never().optional(),
    object_key: z.never().optional(),
  })
  .passthrough();

export const exportListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const exportJobParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const createExportBodySchema = rejectClientTenantFields.strict();

export const exportJobDtoSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(JOB_STATUSES),
    requestedByMembershipId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
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

export const exportListResponseSchema = z.object({
  data: z.object({
    items: z.array(exportJobDtoSchema.omit({ download: true })),
    pageInfo: z.object({
      nextCursor: z.string().uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const createExportResponseSchema = z.object({
  data: exportJobDtoSchema.omit({ download: true }),
});

export const exportJobDetailResponseSchema = z.object({
  data: exportJobDtoSchema,
});

export const deletionListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const deletionRequestParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const createDeletionRequestBodySchema = rejectClientTenantFields
  .extend({
    confirm: z.literal(true),
    targetMembershipId: z.string().uuid().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const processDeletionRequestBodySchema = rejectClientTenantFields
  .extend({
    confirm: z.literal(true),
  })
  .strict();

export const deletionRequestDtoSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(JOB_STATUSES),
    targetType: z.literal("membership"),
    targetId: z.string().uuid(),
    requestedByMembershipId: z.string().uuid().nullable(),
    reason: z.string().nullable(),
    scheduledAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const deletionListResponseSchema = z.object({
  data: z.object({
    items: z.array(deletionRequestDtoSchema),
    pageInfo: z.object({
      nextCursor: z.string().uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const createDeletionRequestResponseSchema = z.object({
  data: deletionRequestDtoSchema,
});

export const processDeletionRequestResponseSchema = z.object({
  data: deletionRequestDtoSchema,
});

export type ExportListQuery = z.output<typeof exportListQuerySchema>;
export type DeletionListQuery = z.output<typeof deletionListQuerySchema>;
export type CreateDeletionRequestBody = z.output<typeof createDeletionRequestBodySchema>;
export type ProcessDeletionRequestBody = z.output<typeof processDeletionRequestBodySchema>;
