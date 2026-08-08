import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentOverviewQuerySchema,
  paymentOverviewResponseSchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { getPaymentOverview } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentOverviewQuerySchema>,
  z.output<typeof paymentOverviewResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentOverviewQuerySchema,
  output: paymentOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getPaymentOverview(tx, ctx, input),
});
