import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveLearnersListQuerySchema,
  liveLearnersListResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { listLiveClassAttendanceLearners } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveLearnersListQuerySchema>,
  z.output<typeof liveLearnersListResponseSchema>
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveLearnersListQuerySchema,
  output: liveLearnersListResponseSchema,
  handler: async ({ tx, ctx, input }) => listLiveClassAttendanceLearners(tx, ctx, input),
});
