import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentOrderSummaryQuerySchema,
  paymentOrderSummaryResponseSchema,
} from "@atlas/domain/payments/payments.dto";
import { summarisePaymentOrders } from "@atlas/domain/payments/payments.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/payments/orders/summary` — ledger-wide counts for the filters
 * the list is showing, so the signal band describes the ledger rather than the
 * page currently loaded.
 */
export const GET = createTenantRoute<
  z.output<typeof paymentOrderSummaryQuerySchema>,
  z.output<typeof paymentOrderSummaryResponseSchema>
>({
  metadata: routeMetadata,
  input: paymentOrderSummaryQuerySchema,
  output: paymentOrderSummaryResponseSchema,
  handler: async ({ tx, ctx, input }) => summarisePaymentOrders(tx, ctx, input),
});
