import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createResourceUsageExportBodySchema,
  createResourceUsageExportResponseSchema,
  resourceUsageExportsResponseSchema,
} from "@atlas/domain/reports/resource-usage-exports.dto";
import {
  createResourceUsageExportMetadata,
  getResourceUsageExportsMetadata,
} from "@atlas/domain/reports/resource-usage-exports.route-metadata";
import {
  createResourceUsageExport,
  getResourceUsageExports,
} from "@atlas/domain/reports/resource-usage-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof resourceUsageExportsResponseSchema>
>({
  metadata: getResourceUsageExportsMetadata,
  input: noBodySchema,
  output: resourceUsageExportsResponseSchema,
  handler: async ({ tx, ctx }) => getResourceUsageExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createResourceUsageExportBodySchema>,
  z.output<typeof createResourceUsageExportResponseSchema>
>({
  metadata: createResourceUsageExportMetadata,
  body: createResourceUsageExportBodySchema,
  output: createResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createResourceUsageExport(tx, ctx, input),
});
