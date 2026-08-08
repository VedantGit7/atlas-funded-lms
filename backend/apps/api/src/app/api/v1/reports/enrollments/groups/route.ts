import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createEnrollmentGroupBodySchema,
  createEnrollmentGroupResponseSchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { createEnrollmentGroupMetadata } from "@atlas/domain/reports/enrollments-roster.route-metadata";
import { createEnrollmentGroup } from "@atlas/domain/reports/enrollments-roster.service";

export const POST = createTenantRoute<
  z.output<typeof createEnrollmentGroupBodySchema>,
  z.output<typeof createEnrollmentGroupResponseSchema>
>({
  metadata: createEnrollmentGroupMetadata,
  body: createEnrollmentGroupBodySchema,
  output: createEnrollmentGroupResponseSchema,
  handler: async ({ tx, ctx, input }) => createEnrollmentGroup(tx, ctx, input),
});
