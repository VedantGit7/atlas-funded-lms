import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createCustomFieldExportBodySchema,
  createCustomFieldExportResponseSchema,
  customFieldExportsResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import {
  createCustomFieldExportMetadata,
  getCustomFieldExportsMetadata,
} from "@atlas/domain/reports/custom-field-exports.route-metadata";
import {
  createCustomFieldExport,
  getCustomFieldExports,
} from "@atlas/domain/reports/custom-field-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldExportsResponseSchema>
>({
  metadata: getCustomFieldExportsMetadata,
  input: noBodySchema,
  output: customFieldExportsResponseSchema,
  handler: async ({ tx, ctx }) => getCustomFieldExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCustomFieldExportBodySchema>,
  z.output<typeof createCustomFieldExportResponseSchema>
>({
  metadata: createCustomFieldExportMetadata,
  body: createCustomFieldExportBodySchema,
  output: createCustomFieldExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomFieldExport(tx, ctx, input),
});
