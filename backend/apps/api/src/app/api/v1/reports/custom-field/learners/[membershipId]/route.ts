import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  customFieldLearnerDetailResponseSchema,
  customFieldLearnerParamsSchema,
  updateCustomFieldLearnerValuesBodySchema,
  updateCustomFieldLearnerValuesResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import {
  listCustomFieldRosterMetadata,
  mutateCustomFieldRosterMetadata,
} from "@atlas/domain/reports/custom-field-roster.route-metadata";
import {
  getCustomFieldLearnerDetail,
  updateCustomFieldLearnerValues,
} from "@atlas/domain/reports/custom-field-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldLearnerDetailResponseSchema>,
  typeof customFieldLearnerParamsSchema
>({
  metadata: listCustomFieldRosterMetadata,
  input: noBodySchema,
  params: customFieldLearnerParamsSchema,
  output: customFieldLearnerDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getCustomFieldLearnerDetail(tx, ctx, params["membershipId"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateCustomFieldLearnerValuesBodySchema>,
  z.output<typeof updateCustomFieldLearnerValuesResponseSchema>,
  typeof customFieldLearnerParamsSchema
>({
  metadata: mutateCustomFieldRosterMetadata,
  params: customFieldLearnerParamsSchema,
  input: updateCustomFieldLearnerValuesBodySchema,
  output: updateCustomFieldLearnerValuesResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateCustomFieldLearnerValues(tx, ctx, params["membershipId"], input),
});
