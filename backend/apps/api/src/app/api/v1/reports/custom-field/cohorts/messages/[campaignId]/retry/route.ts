import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  retryCustomFieldCohortMessageBodySchema,
  retryCustomFieldCohortMessageParamsSchema,
  retryCustomFieldCohortMessageResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { mutateCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { retryCustomFieldCohortMessage } from "@atlas/api-server/reports/custom-field-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof retryCustomFieldCohortMessageBodySchema>,
  z.output<typeof retryCustomFieldCohortMessageResponseSchema>,
  typeof retryCustomFieldCohortMessageParamsSchema
>({
  metadata: mutateCustomFieldRosterMetadata,
  body: retryCustomFieldCohortMessageBodySchema,
  params: retryCustomFieldCohortMessageParamsSchema,
  output: retryCustomFieldCohortMessageResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    retryCustomFieldCohortMessage(tx, ctx, params["campaignId"], input),
});
