import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldCatalogueQuerySchema,
  customFieldCatalogueResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { listCustomFieldCatalogue } from "@atlas/domain/reports/custom-field-roster.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldCatalogueQuerySchema>,
  z.output<typeof customFieldCatalogueResponseSchema>
>({
  metadata: listCustomFieldRosterMetadata,
  input: customFieldCatalogueQuerySchema,
  output: customFieldCatalogueResponseSchema,
  handler: async ({ tx, ctx, input }) => listCustomFieldCatalogue(tx, ctx, input),
});
