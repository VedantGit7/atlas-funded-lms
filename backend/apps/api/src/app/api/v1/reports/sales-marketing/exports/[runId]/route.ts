import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  smExportRunDetailResponseSchema,
  smExportRunParamsSchema,
} from "@atlas/domain/reports/sales-marketing-exports.dto";
import { getSalesMarketingExportsMetadata } from "@atlas/domain/reports/sales-marketing-exports.route-metadata";
import { getSalesMarketingExportRun } from "@atlas/domain/reports/sales-marketing-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof smExportRunDetailResponseSchema>,
  typeof smExportRunParamsSchema
>({
  metadata: getSalesMarketingExportsMetadata,
  params: smExportRunParamsSchema,
  input: noBodySchema,
  output: smExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSalesMarketingExportRun(tx, ctx, params["runId"]),
});
