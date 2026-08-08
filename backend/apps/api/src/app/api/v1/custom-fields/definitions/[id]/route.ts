import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldDefinitionResponseSchema,
  updateCustomFieldDefinitionBodySchema,
} from "@atlas/domain/custom-fields/custom-fields.dto";
import {
  deleteCustomFieldDefinitionMetadata,
  updateCustomFieldDefinitionMetadata,
} from "@atlas/domain/custom-fields/custom-fields.route-metadata";
import {
  deleteCustomFieldDefinition,
  updateCustomFieldDefinition,
} from "@atlas/domain/custom-fields/custom-fields.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateCustomFieldDefinitionBodySchema>,
  z.output<typeof customFieldDefinitionResponseSchema>,
  typeof paramsSchema
>({
  metadata: updateCustomFieldDefinitionMetadata,
  params: paramsSchema,
  input: updateCustomFieldDefinitionBodySchema,
  output: customFieldDefinitionResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateCustomFieldDefinition(tx, ctx, params.id, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  { data: { deleted: boolean } },
  typeof paramsSchema
>({
  metadata: deleteCustomFieldDefinitionMetadata,
  params: paramsSchema,
  handler: async ({ tx, ctx, params }) => deleteCustomFieldDefinition(tx, ctx, params.id),
});
