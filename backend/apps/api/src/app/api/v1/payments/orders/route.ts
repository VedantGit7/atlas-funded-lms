import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPaymentOrderBodySchema,
  createPaymentOrderResponseSchema,
  listPaymentOrdersQuerySchema,
  listPaymentOrdersResponseSchema,
} from "@atlas/domain/payments/payments.dto";
import {
  createPaymentOrderMetadata,
  listPaymentOrdersMetadata,
} from "@atlas/domain/payments/payments.route-metadata";
import { createPaymentOrder, listPaymentOrders } from "@atlas/domain/payments/payments.service";

export const GET = createTenantRoute<
  z.output<typeof listPaymentOrdersQuerySchema>,
  z.output<typeof listPaymentOrdersResponseSchema>
>({
  metadata: listPaymentOrdersMetadata,
  input: listPaymentOrdersQuerySchema,
  output: listPaymentOrdersResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentOrders(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createPaymentOrderBodySchema>,
  z.output<typeof createPaymentOrderResponseSchema>
>({
  metadata: createPaymentOrderMetadata,
  input: createPaymentOrderBodySchema,
  output: createPaymentOrderResponseSchema,
  handler: async ({ tx, ctx, input }) => createPaymentOrder(tx, ctx, input),
});
