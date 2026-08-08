import { z } from "zod";

export const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
  })
  .passthrough();

export const pageInfoSchema = z.object({
  nextCursor: z.string().uuid().nullable(),
  hasNextPage: z.boolean(),
});

export const ENTITY_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export const PAYMENT_ORDER_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;
