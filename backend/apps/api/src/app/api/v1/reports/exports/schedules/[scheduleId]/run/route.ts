import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  runScheduleNowResponseSchema,
  scheduleParamsSchema,
} from "@atlas/domain/reports/schedules-roster.dto";
import { runScheduleNowMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { runReportScheduleNow } from "@atlas/domain/reports/schedules-roster.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof runScheduleNowResponseSchema>,
  typeof scheduleParamsSchema
>({
  metadata: runScheduleNowMetadata,
  params: scheduleParamsSchema,
  output: runScheduleNowResponseSchema,
  handler: async ({ tx, ctx, params }) => runReportScheduleNow(tx, ctx, params["scheduleId"]),
});
