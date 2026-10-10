import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPaymentExportBodySchema,
  createPaymentExportResponseSchema,
  paymentExportsResponseSchema,
} from "@atlas/domain/reports/payments-exports.dto";
import {
  createPaymentExport,
  getPaymentExports,
} from "@atlas/domain/reports/payments-exports.service";
import { scheduleReportExportProcessing } from "../../../../../../server/reports/report-exports-async";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof paymentExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: paymentExportsResponseSchema,
  handler: async ({ tx, ctx }) => getPaymentExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createPaymentExportBodySchema>,
  z.output<typeof createPaymentExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createPaymentExportBodySchema,
  output: createPaymentExportResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const result = await createPaymentExport(tx, ctx, input);
    scheduleReportExportProcessing("payments", {
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
      actorMembershipId: ctx.actorMembershipId,
      reportRunId: result.data.run.id,
      format: result.data.run.format === "pdf" ? "csv" : result.data.run.format,
      requestedAt: result.data.run.createdAt,
    });
    return result;
  },
});
