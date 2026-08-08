import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  enrollmentOverviewQuerySchema,
  enrollmentOverviewResponseSchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { getEnrollmentOverviewMetadata } from "@atlas/domain/reports/enrollments-roster.route-metadata";
import { getEnrollmentOverview } from "@atlas/domain/reports/enrollments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof enrollmentOverviewQuerySchema>,
  z.output<typeof enrollmentOverviewResponseSchema>
>({
  metadata: getEnrollmentOverviewMetadata,
  input: enrollmentOverviewQuerySchema,
  output: enrollmentOverviewResponseSchema,
  handler: async ({ tx, ctx, input }) => getEnrollmentOverview(tx, ctx, input),
});
