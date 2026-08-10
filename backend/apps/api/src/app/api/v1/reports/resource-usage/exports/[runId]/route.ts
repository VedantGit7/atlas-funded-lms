import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  resourceUsageExportRunDetailResponseSchema,
  resourceUsageExportRunParamsSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import { getResourceUsageExportsMetadata } from "@atlas/domain/reports/resource-usage-exports.route-metadata";
import { getResourceUsageExportRun } from "@atlas/domain/reports/resource-usage-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof resourceUsageExportRunDetailResponseSchema>,
  typeof resourceUsageExportRunParamsSchema
>({
  metadata: getResourceUsageExportsMetadata,
  params: resourceUsageExportRunParamsSchema,
  input: noBodySchema,
  output: resourceUsageExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getResourceUsageExportRun(tx, ctx, params["runId"]),
});
