import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retrySalesMarketingExportResponseSchema } from "@atlas/domain/reports/sales-marketing-exports.dto";
import { retrySalesMarketingExport } from "@atlas/domain/reports/sales-marketing-exports.service";
import { scheduleReportExportProcessing } from "../../../../../../../../server/reports/report-exports-async";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retrySalesMarketingExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retrySalesMarketingExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await retrySalesMarketingExport(tx, ctx, params["runId"]);
    scheduleReportExportProcessing("sales-marketing", {
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
