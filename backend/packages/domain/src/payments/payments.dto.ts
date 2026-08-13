import { z } from "zod";
import {
  pageInfoSchema,
  PAYMENT_ORDER_STATUSES,
  rejectClientTenantFields,
} from "../shared/domain.dto";

export const createPaymentOrderBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid().optional(),
    externalId: z.string().max(256).optional(),
    amountCents: z.number().int().min(0),
    currency: z.string().length(3).default("USD"),
    status: z.enum(PAYMENT_ORDER_STATUSES).default("pending"),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const listPaymentOrdersQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(PAYMENT_ORDER_STATUSES).optional(),
  })
  .strict();

export const stripeWebhookBodySchema = z
  .object({
    externalId: z.string().min(1),
    status: z.enum(PAYMENT_ORDER_STATUSES),
    paidAt: z.iso.datetime().optional(),
  })
  .strict();

export const paymentOrderDtoSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid().nullable(),
    externalId: z.string().nullable(),
    amountCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
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

export const paymentWebhookResponseSchema = z.object({
  data: z.object({
    updated: z.boolean(),
    orderId: z.uuid().nullable(),
  }),
});

export const stripeWebhookResponseSchema = paymentWebhookResponseSchema;
export const razorpayWebhookResponseSchema = paymentWebhookResponseSchema;
