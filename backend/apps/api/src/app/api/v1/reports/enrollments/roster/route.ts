import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  enrollmentRosterListResponseSchema,
  enrollmentRosterQuerySchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { listEnrollmentRosterMetadata } from "@atlas/domain/reports/enrollments-roster.route-metadata";
import { listEnrollmentRoster } from "@atlas/domain/reports/enrollments-roster.service";

export const GET = createTenantRoute<
  z.output<typeof enrollmentRosterQuerySchema>,
  z.output<typeof enrollmentRosterListResponseSchema>
>({
  metadata: listEnrollmentRosterMetadata,
  input: enrollmentRosterQuerySchema,
  output: enrollmentRosterListResponseSchema,
  handler: async ({ tx, ctx, input }) => listEnrollmentRoster(tx, ctx, input),
});
