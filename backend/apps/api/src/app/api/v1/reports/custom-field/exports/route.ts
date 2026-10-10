import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createCustomFieldExportBodySchema,
  createCustomFieldExportResponseSchema,
  customFieldExportsResponseSchema,
} from "@atlas/domain/reports/custom-field-exports.dto";
import {
  createCustomFieldExport,
  getCustomFieldExports,
} from "@atlas/domain/reports/custom-field-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: customFieldExportsResponseSchema,
  handler: async ({ tx, ctx }) => getCustomFieldExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCustomFieldExportBodySchema>,
  z.output<typeof createCustomFieldExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createCustomFieldExportBodySchema,
  output: createCustomFieldExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomFieldExport(tx, ctx, input),
});
