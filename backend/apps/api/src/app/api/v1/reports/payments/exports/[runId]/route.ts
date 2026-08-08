import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  paymentExportRunDetailResponseSchema,
  paymentExportRunParamsSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import { getPaymentExportsMetadata } from "@atlas/domain/reports/payments-exports.route-metadata";
import { getPaymentExportRun } from "@atlas/domain/reports/payments-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentExportRunDetailResponseSchema>,
  typeof paymentExportRunParamsSchema
>({
  metadata: getPaymentExportsMetadata,
  params: paymentExportRunParamsSchema,
  input: noBodySchema,
  output: paymentExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPaymentExportRun(tx, ctx, params["runId"]),
});
