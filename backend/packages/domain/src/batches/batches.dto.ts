import { z } from "zod";
import { ENTITY_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

export const createBatchBodySchema = rejectClientTenantFields
  .extend({
    key: z.string().min(1).max(64),
    name: z.string().min(1).max(256),
    courseId: z.uuid().optional(),
    status: z.enum(ENTITY_STATUSES).default("ACTIVE"),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateBatchBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().min(1).max(256).optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const assignBatchMemberBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid(),
  })
  .strict();

export const batchParamsSchema = z.object({ id: z.uuid() }).strict();

export const batchDtoSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    courseId: z.uuid().nullable(),
    status: z.enum(ENTITY_STATUSES),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const batchResponseSchema = z.object({ data: batchDtoSchema });
export const batchListResponseSchema = z.object({
  data: z.object({ items: z.array(batchDtoSchema) }),
});

export const assignBatchMemberResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    membershipId: z.uuid(),
    joinedAt: z.iso.datetime(),
  }),
});
