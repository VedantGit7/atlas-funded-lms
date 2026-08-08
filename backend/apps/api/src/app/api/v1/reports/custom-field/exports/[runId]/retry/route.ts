import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  customFieldExportRunParamsSchema,
  retryCustomFieldExportResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import { retryCustomFieldExportMetadata } from "@atlas/domain/reports/custom-field-exports.route-metadata";
import { retryCustomFieldExport } from "@atlas/domain/reports/custom-field-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryCustomFieldExportResponseSchema>,
  typeof customFieldExportRunParamsSchema
>({
  metadata: retryCustomFieldExportMetadata,
  params: customFieldExportRunParamsSchema,
  input: noBodySchema,
  output: retryCustomFieldExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryCustomFieldExport(tx, ctx, params.runId),
});
