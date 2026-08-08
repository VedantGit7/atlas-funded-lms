import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportCustomFieldRosterBodySchema,
  exportCustomFieldRosterResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { exportCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { exportCustomFieldRoster } from "../../../../../../../server/reports/custom-field-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportCustomFieldRosterBodySchema>,
  z.output<typeof exportCustomFieldRosterResponseSchema>
>({
  metadata: exportCustomFieldRosterMetadata,
  body: exportCustomFieldRosterBodySchema,
  output: exportCustomFieldRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportCustomFieldRoster(tx, ctx, input),
});
