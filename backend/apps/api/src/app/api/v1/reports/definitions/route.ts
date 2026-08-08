import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCustomReportDefinitionBodySchema,
  createCustomReportDefinitionResponseSchema,
  reportDefinitionListResponseSchema,
} from "@atlas/domain/reports/reports.dto";
import {
  createCustomReportDefinition,
  listReportDefinitions,
} from "@atlas/domain/reports/reports.service";
import {
  createCustomReportDefinitionMetadata,
  listReportDefinitionsMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof reportDefinitionListResponseSchema>
>({
  metadata: listReportDefinitionsMetadata,
  output: reportDefinitionListResponseSchema,
  handler: async ({ tx, ctx }) => listReportDefinitions(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCustomReportDefinitionBodySchema>,
  z.output<typeof createCustomReportDefinitionResponseSchema>
>({
  metadata: createCustomReportDefinitionMetadata,
  input: createCustomReportDefinitionBodySchema,
  output: createCustomReportDefinitionResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomReportDefinition(tx, ctx, input),
});