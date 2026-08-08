import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  paymentRefundsListResponseSchema,
  paymentRefundsQuerySchema,
} from "@atlas/domain/reports/payments-roster.dto";
import { listPaymentsRosterMetadata } from "@atlas/domain/reports/payments-roster.route-metadata";
import { listPaymentRefunds } from "@atlas/domain/reports/payments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof paymentRefundsQuerySchema>,
  z.output<typeof paymentRefundsListResponseSchema>
>({
  metadata: listPaymentsRosterMetadata,
  input: paymentRefundsQuerySchema,
  output: paymentRefundsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPaymentRefunds(tx, ctx, input),
});
