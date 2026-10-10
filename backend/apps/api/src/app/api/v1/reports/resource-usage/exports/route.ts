import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createResourceUsageExportBodySchema,
  createResourceUsageExportResponseSchema,
  resourceUsageExportsResponseSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import {
  createResourceUsageExport,
  getResourceUsageExports,
} from "@atlas/domain/reports/resource-usage-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof resourceUsageExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: resourceUsageExportsResponseSchema,
  handler: async ({ tx, ctx }) => getResourceUsageExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createResourceUsageExportBodySchema>,
  z.output<typeof createResourceUsageExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createResourceUsageExportBodySchema,
  output: createResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createResourceUsageExport(tx, ctx, input),
});
