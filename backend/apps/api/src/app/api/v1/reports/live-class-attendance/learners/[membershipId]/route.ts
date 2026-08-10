import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveLearnerDetailQuerySchema,
  liveLearnerDetailResponseSchema,
  liveLearnerMembershipIdParamsSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { getLiveClassLearnerAttendanceDetail } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveLearnerDetailQuerySchema>,
  z.output<typeof liveLearnerDetailResponseSchema>,
  typeof liveLearnerMembershipIdParamsSchema
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveLearnerDetailQuerySchema,
  params: liveLearnerMembershipIdParamsSchema,
  output: liveLearnerDetailResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getLiveClassLearnerAttendanceDetail(tx, ctx, params["membershipId"], input),
});
