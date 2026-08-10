import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveLearnersMatrixQuerySchema,
  liveLearnersMatrixResponseSchema,
} from "@atlas/domain/reports/live-class-attendance-roster.dto";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";
import { getLiveClassAttendanceLearnersMatrix } from "@atlas/domain/reports/live-class-attendance-roster.service";

export const GET = createTenantRoute<
  z.output<typeof liveLearnersMatrixQuerySchema>,
  z.output<typeof liveLearnersMatrixResponseSchema>
>({
  metadata: listLiveClassAttendanceRosterMetadata,
  input: liveLearnersMatrixQuerySchema,
  output: liveLearnersMatrixResponseSchema,
  handler: async ({ tx, ctx, input }) => getLiveClassAttendanceLearnersMatrix(tx, ctx, input),
});
