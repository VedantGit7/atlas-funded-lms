import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSalesMarketingExportBodySchema,
  createSalesMarketingExportResponseSchema,
  salesMarketingExportsResponseSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";
import {
  createSalesMarketingExportMetadata,
  getSalesMarketingExportsMetadata,
} from "@atlas/domain/reports/sales-marketing-exports.route-metadata";
import {
  createSalesMarketingExport,
  getSalesMarketingExports,
} from "@atlas/domain/reports/sales-marketing-exports.service";
import { scheduleSalesMarketingExportProcessing } from "../../../../../../server/reports/sales-marketing-exports-async";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof salesMarketingExportsResponseSchema>
>({
  metadata: getSalesMarketingExportsMetadata,
  input: noBodySchema,
  output: salesMarketingExportsResponseSchema,
  handler: async ({ tx, ctx }) => getSalesMarketingExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createSalesMarketingExportBodySchema>,
  z.output<typeof createSalesMarketingExportResponseSchema>
>({
  metadata: createSalesMarketingExportMetadata,
  body: createSalesMarketingExportBodySchema,
  output: createSalesMarketingExportResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const result = await createSalesMarketingExport(tx, ctx, input);
    scheduleSalesMarketingExportProcessing({
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
