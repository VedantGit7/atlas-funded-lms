import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  unmatchedPaymentOrdersQuerySchema,
  unmatchedPaymentOrdersResponseSchema,
} from "@atlas/domain/payments/payments.dto";
import { getUnmatchedPaymentOrders } from "@atlas/domain/payments/payments.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/payments/orders/unmatched` — the orders no webhook can settle.
 *
 * A ledger-wide scan, not a pass over a page: the counts describe the whole
 * ledger and only the row samples are capped.
 */
export const GET = createTenantRoute<
  z.output<typeof unmatchedPaymentOrdersQuerySchema>,
  z.output<typeof unmatchedPaymentOrdersResponseSchema>
>({
  metadata: routeMetadata,
  input: unmatchedPaymentOrdersQuerySchema,
  output: unmatchedPaymentOrdersResponseSchema,
  handler: async ({ tx, ctx, input }) => getUnmatchedPaymentOrders(tx, ctx, input),
});
