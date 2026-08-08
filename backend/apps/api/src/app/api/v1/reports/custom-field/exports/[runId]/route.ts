import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  customFieldExportRunDetailResponseSchema,
  customFieldExportRunParamsSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import { getCustomFieldExportsMetadata } from "@atlas/domain/reports/custom-field-exports.route-metadata";
import { getCustomFieldExportRun } from "@atlas/domain/reports/custom-field-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldExportRunDetailResponseSchema>,
  typeof customFieldExportRunParamsSchema
>({
  metadata: getCustomFieldExportsMetadata,
  params: customFieldExportRunParamsSchema,
  input: noBodySchema,
  output: customFieldExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getCustomFieldExportRun(tx, ctx, params["runId"]),
});
