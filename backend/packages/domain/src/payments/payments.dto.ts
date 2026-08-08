import { z } from "zod";
import { pageInfoSchema, PAYMENT_ORDER_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

export const createPaymentOrderBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.string().uuid().optional(),
    externalId: z.string().max(256).optional(),
    amountCents: z.number().int().min(0),
    currency: z.string().length(3).default("USD"),
    status: z.enum(PAYMENT_ORDER_STATUSES).default("pending"),
    metadataJson: z.record(z.unknown()).optional(),
  })
  .strict();

export const listPaymentOrdersQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(PAYMENT_ORDER_STATUSES).optional(),
  })
  .strict();

export const stripeWebhookBodySchema = z
  .object({
    externalId: z.string().min(1),
    status: z.enum(PAYMENT_ORDER_STATUSES),
    paidAt: z.string().datetime().optional(),
  })
  .strict();

export const paymentOrderDtoSchema = z
  .object({
    id: z.string().uuid(),
    membershipId: z.string().uuid().nullable(),
    externalId: z.string().nullable(),
    amountCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    paidAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const createPaymentOrderResponseSchema = z.object({
  data: paymentOrderDtoSchema,
});

export const listPaymentOrdersResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentOrderDtoSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const stripeWebhookResponseSchema = z.object({
  data: z.object({
    updated: z.boolean(),
    orderId: z.string().uuid().nullable(),
  }),
});
