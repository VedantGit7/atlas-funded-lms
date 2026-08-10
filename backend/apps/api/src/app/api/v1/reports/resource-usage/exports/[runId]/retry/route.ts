import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  resourceUsageExportRunParamsSchema,
  retryResourceUsageExportResponseSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import { retryResourceUsageExportMetadata } from "@atlas/domain/reports/resource-usage-exports.route-metadata";
import { retryResourceUsageExport } from "@atlas/domain/reports/resource-usage-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryResourceUsageExportResponseSchema>,
  typeof resourceUsageExportRunParamsSchema
>({
  metadata: retryResourceUsageExportMetadata,
  params: resourceUsageExportRunParamsSchema,
  input: noBodySchema,
  output: retryResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryResourceUsageExport(tx, ctx, params["runId"]),
});
