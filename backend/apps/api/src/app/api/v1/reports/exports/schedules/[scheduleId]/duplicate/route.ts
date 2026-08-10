import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  duplicateScheduleResponseSchema,
  scheduleDetailParamsSchema,
} from "@atlas/domain/reports/schedule-detail.dto";
import { duplicateScheduleMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { duplicateReportSchedule } from "@atlas/domain/reports/schedule-detail.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof duplicateScheduleResponseSchema>,
  typeof scheduleDetailParamsSchema
>({
  metadata: duplicateScheduleMetadata,
  params: scheduleDetailParamsSchema,
  output: duplicateScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) => duplicateReportSchedule(tx, ctx, params["scheduleId"]),
});
