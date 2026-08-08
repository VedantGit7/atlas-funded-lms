import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  retrySalesMarketingExportResponseSchema,
  smExportRunParamsSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";
import { retrySalesMarketingExportMetadata } from "@atlas/domain/reports/sales-marketing-exports.route-metadata";
import { retrySalesMarketingExport } from "@atlas/domain/reports/sales-marketing-exports.service";
import { scheduleSalesMarketingExportProcessing } from "../../../../../../../../server/reports/sales-marketing-exports-async";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retrySalesMarketingExportResponseSchema>,
  typeof smExportRunParamsSchema
>({
  metadata: retrySalesMarketingExportMetadata,
  params: smExportRunParamsSchema,
  input: noBodySchema,
  output: retrySalesMarketingExportResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await retrySalesMarketingExport(tx, ctx, params["runId"]);
    scheduleSalesMarketingExportProcessing({
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
