import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCustomFieldGroupBodySchema,
  createCustomFieldGroupResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { mutateCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { createCustomFieldRosterGroup } from "@atlas/api-server/reports/custom-field-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof createCustomFieldGroupBodySchema>,
  z.output<typeof createCustomFieldGroupResponseSchema>
>({
  metadata: mutateCustomFieldRosterMetadata,
  body: createCustomFieldGroupBodySchema,
  output: createCustomFieldGroupResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomFieldRosterGroup(tx, ctx, input),
});
