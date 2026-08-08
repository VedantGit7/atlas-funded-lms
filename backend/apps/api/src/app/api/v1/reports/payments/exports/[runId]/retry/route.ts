import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  paymentExportRunParamsSchema,
  retryPaymentExportResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import { retryPaymentExportMetadata } from "@atlas/domain/reports/payments-exports.route-metadata";
import { retryPaymentExport } from "@atlas/domain/reports/payments-exports.service";
import { schedulePaymentExportProcessing } from "../../../../../../../../server/reports/payments-exports-async";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryPaymentExportResponseSchema>,
  typeof paymentExportRunParamsSchema
>({
  metadata: retryPaymentExportMetadata,
  params: paymentExportRunParamsSchema,
  input: noBodySchema,
  output: retryPaymentExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await retryPaymentExport(tx, ctx, params["runId"]);
    schedulePaymentExportProcessing({
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      actorMembershipId: ctx.actorMembershipId,
      reportRunId: result.data.id,
      format: result.data.format === "pdf" ? "csv" : result.data.format,
      requestedAt: result.data.createdAt,
    });
    return result;
  },
});
