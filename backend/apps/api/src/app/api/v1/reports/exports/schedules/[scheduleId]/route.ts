import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scheduleDetailParamsSchema,
  scheduleDetailQuerySchema,
  scheduleDetailResponseSchema,
} from "@atlas/domain/reports/schedule-detail.dto";
import { getScheduleDetailMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { getScheduleDetail } from "@atlas/domain/reports/schedule-detail.service";

export const GET = createTenantRoute<
  z.output<typeof scheduleDetailQuerySchema>,
  z.output<typeof scheduleDetailResponseSchema>,
  typeof scheduleDetailParamsSchema
>({
  metadata: getScheduleDetailMetadata,
  params: scheduleDetailParamsSchema,
  input: scheduleDetailQuerySchema,
  output: scheduleDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    getScheduleDetail(tx, ctx, params["scheduleId"], input),
});
