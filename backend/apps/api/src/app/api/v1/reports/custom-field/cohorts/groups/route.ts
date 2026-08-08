import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldCohortGroupsQuerySchema,
  customFieldCohortGroupsResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { listCustomFieldCohortGroups } from "@atlas/domain/reports/custom-field-cohorts.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldCohortGroupsQuerySchema>,
  z.output<typeof customFieldCohortGroupsResponseSchema>
>({
  metadata: listCustomFieldRosterMetadata,
  input: customFieldCohortGroupsQuerySchema,
  output: customFieldCohortGroupsResponseSchema,
  handler: async ({ tx, ctx, input }) => listCustomFieldCohortGroups(tx, ctx, input),
});
