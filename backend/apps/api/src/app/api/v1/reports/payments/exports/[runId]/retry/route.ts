import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryPaymentExportResponseSchema } from "@atlas/domain/reports/payments-exports.dto";
import { retryPaymentExport } from "@atlas/domain/reports/payments-exports.service";
import { scheduleReportExportProcessing } from "../../../../../../../../server/reports/report-exports-async";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryPaymentExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryPaymentExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await retryPaymentExport(tx, ctx, params["runId"]);
    scheduleReportExportProcessing("payments", {
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
