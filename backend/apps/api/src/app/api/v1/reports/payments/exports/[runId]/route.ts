import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { paymentExportRunDetailResponseSchema } from "@atlas/domain/reports/payments-exports.dto";
import { getPaymentExportRun } from "@atlas/domain/reports/payments-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: paymentExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPaymentExportRun(tx, ctx, params["runId"]),
});
