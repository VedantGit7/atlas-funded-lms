import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldValueListResponseSchema,
  customFieldValueResponseSchema,
  setCustomFieldValueBodySchema,
} from "@atlas/domain/custom-fields/custom-fields.dto";
import {
  listCustomFieldValuesMetadata,
  setCustomFieldValueMetadata,
} from "@atlas/domain/custom-fields/custom-fields.route-metadata";
import {
  listCustomFieldValues,
  setCustomFieldValue,
} from "@atlas/domain/custom-fields/custom-fields.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldValueListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listCustomFieldValuesMetadata,
  params: paramsSchema,
  output: customFieldValueListResponseSchema,
  handler: async ({ tx, ctx, params }) => listCustomFieldValues(tx, ctx, params["id"]),
});

export const POST = createTenantRoute<
  z.output<typeof setCustomFieldValueBodySchema>,
  z.output<typeof customFieldValueResponseSchema>,
  typeof paramsSchema
>({
  metadata: setCustomFieldValueMetadata,
  params: paramsSchema,
  input: setCustomFieldValueBodySchema,
  output: customFieldValueResponseSchema,
  handler: async ({ tx, ctx, params, input }) => setCustomFieldValue(tx, ctx, params["id"], input),
});
