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
  .loose();

export const exportListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const exportJobParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const createExportBodySchema = rejectClientTenantFields.strict();

export const exportJobDtoSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(JOB_STATUSES),
    requestedByMembershipId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
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

export const exportListResponseSchema = z.object({
  data: z.object({
    items: z.array(exportJobDtoSchema.omit({ download: true })),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
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
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

export const deletionRequestParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const createDeletionRequestBodySchema = rejectClientTenantFields
  .extend({
    confirm: z.literal(true),
    targetMembershipId: z.uuid().optional(),
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
    id: z.uuid(),
    status: z.enum(JOB_STATUSES),
    targetType: z.literal("membership"),
    targetId: z.uuid(),
    requestedByMembershipId: z.uuid().nullable(),
    reason: z.string().nullable(),
    scheduledAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const deletionListResponseSchema = z.object({
  data: z.object({
    items: z.array(deletionRequestDtoSchema),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
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

export const myDeletionRequestStatusResponseSchema = z.object({
  data: z.object({
    pending: z.boolean(),
  }),
});

export type ExportListQuery = z.output<typeof exportListQuerySchema>;
export type DeletionListQuery = z.output<typeof deletionListQuerySchema>;
export type CreateDeletionRequestBody = z.output<typeof createDeletionRequestBodySchema>;
export type ProcessDeletionRequestBody = z.output<typeof processDeletionRequestBodySchema>;
