import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportEnrollmentRosterBodySchema,
  exportEnrollmentRosterResponseSchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { exportEnrollmentRosterMetadata } from "@atlas/domain/reports/enrollments-roster.route-metadata";
import { exportEnrollmentRoster } from "../../../../../../server/reports/enrollments-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportEnrollmentRosterBodySchema>,
  z.output<typeof exportEnrollmentRosterResponseSchema>
>({
  metadata: exportEnrollmentRosterMetadata,
  body: exportEnrollmentRosterBodySchema,
  output: exportEnrollmentRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportEnrollmentRoster(tx, ctx, input),
});
