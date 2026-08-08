import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCustomFieldDefinitionBodySchema,
  customFieldDefinitionListResponseSchema,
  customFieldDefinitionResponseSchema,
} from "@atlas/domain/custom-fields/custom-fields.dto";
import {
  createCustomFieldDefinitionMetadata,
  listCustomFieldDefinitionsMetadata,
} from "@atlas/domain/custom-fields/custom-fields.route-metadata";
import {
  createCustomFieldDefinition,
  listCustomFieldDefinitions,
} from "@atlas/domain/custom-fields/custom-fields.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldDefinitionListResponseSchema>
>({
  metadata: listCustomFieldDefinitionsMetadata,
  output: customFieldDefinitionListResponseSchema,
  handler: async ({ tx, ctx }) => listCustomFieldDefinitions(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCustomFieldDefinitionBodySchema>,
  z.output<typeof customFieldDefinitionResponseSchema>
>({
  metadata: createCustomFieldDefinitionMetadata,
  input: createCustomFieldDefinitionBodySchema,
  output: customFieldDefinitionResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomFieldDefinition(tx, ctx, input),
});
