import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldRosterListResponseSchema,
  customFieldRosterQuerySchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { listCustomFieldRoster } from "@atlas/domain/reports/custom-field-roster.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldRosterQuerySchema>,
  z.output<typeof customFieldRosterListResponseSchema>
>({
  metadata: listCustomFieldRosterMetadata,
  input: customFieldRosterQuerySchema,
  output: customFieldRosterListResponseSchema,
  handler: async ({ tx, ctx, input }) => listCustomFieldRoster(tx, ctx, input),
});
