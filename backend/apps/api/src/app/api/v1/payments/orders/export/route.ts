import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportPaymentOrdersQuerySchema,
  exportPaymentOrdersResponseSchema,
} from "@atlas/domain/payments/payments.dto";
import { exportPaymentOrders } from "@atlas/domain/payments/payments.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/payments/orders/export` — the whole filtered ledger in one
 * response, for a CSV the operator downloads.
 *
 * A GET because it reads and does not mutate; the ceiling and whether it was
 * reached are both in the payload.
 */
export const GET = createTenantRoute<
  z.output<typeof exportPaymentOrdersQuerySchema>,
  z.output<typeof exportPaymentOrdersResponseSchema>
>({
  metadata: routeMetadata,
  input: exportPaymentOrdersQuerySchema,
  output: exportPaymentOrdersResponseSchema,
  handler: async ({ tx, ctx, input }) => exportPaymentOrders(tx, ctx, input),
});
