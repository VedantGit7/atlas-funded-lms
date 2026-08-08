import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldCohortMessagesQuerySchema,
  customFieldCohortMessagesResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { listCustomFieldCohortMessages } from "@atlas/domain/reports/custom-field-cohorts.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldCohortMessagesQuerySchema>,
  z.output<typeof customFieldCohortMessagesResponseSchema>
>({
  metadata: listCustomFieldRosterMetadata,
  input: customFieldCohortMessagesQuerySchema,
  output: customFieldCohortMessagesResponseSchema,
  handler: async ({ tx, ctx, input }) => listCustomFieldCohortMessages(tx, ctx, input),
});
