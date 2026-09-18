import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  checkInAttendanceBodySchema,
  checkInAttendanceResponseSchema,
  liveAttendanceListResponseSchema,
} from "@atlas/domain/live/live.dto";
import {
  checkInLiveAttendanceMetadata,
  listLiveAttendanceMetadata,
} from "@atlas/domain/live/live.route-metadata";
import { checkInLiveAttendance, listLiveAttendance } from "@atlas/domain/live/live.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveAttendanceListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listLiveAttendanceMetadata,
  params: paramsSchema,
  output: liveAttendanceListResponseSchema,
  handler: async ({ tx, ctx, params }) => listLiveAttendance(tx, ctx, params["id"]),
});

export const POST = createTenantRoute<
  z.output<typeof checkInAttendanceBodySchema>,
  z.output<typeof checkInAttendanceResponseSchema>,
  typeof paramsSchema
>({
  metadata: checkInLiveAttendanceMetadata,
  params: paramsSchema,
  input: checkInAttendanceBodySchema,
  output: checkInAttendanceResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    checkInLiveAttendance(tx, ctx, params["id"], input),
});
