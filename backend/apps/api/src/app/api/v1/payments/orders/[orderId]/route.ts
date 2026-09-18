import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { paymentOrderDetailResponseSchema } from "@atlas/domain/payments/payments.dto";
import { getPaymentOrder } from "@atlas/domain/payments/payments.service";
import { routeMetadata } from "./route.metadata";

/**
 * The param is named `orderId`, so this route cannot reuse the shared
 * `uuidParamSchema` (which keys on `id`).
 */
const orderIdParamSchema = z.object({
  orderId: z.uuid(),
});

/**
 * `GET /api/v1/payments/orders/[orderId]` — one ledger row in full.
 *
 * Sits beside the static `summary` segment, which Next resolves first.
 */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentOrderDetailResponseSchema>,
  typeof orderIdParamSchema
>({
  metadata: routeMetadata,
  params: orderIdParamSchema,
  output: paymentOrderDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const orderId = params["orderId"];
    if (!orderId) throw new Error("Missing order id");
    return await getPaymentOrder(tx, ctx, orderId);
  },
});
