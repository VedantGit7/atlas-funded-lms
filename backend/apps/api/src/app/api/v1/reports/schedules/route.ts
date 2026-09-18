import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createReportScheduleBodySchema,
  createReportScheduleResponseSchema,
  reportScheduleListResponseSchema,
} from "@atlas/domain/reports/reports.dto";
import { createReportSchedule, listReportSchedules } from "@atlas/domain/reports/reports.service";
import {
  createReportScheduleMetadata,
  listReportSchedulesMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof reportScheduleListResponseSchema>
>({
  metadata: listReportSchedulesMetadata,
  output: reportScheduleListResponseSchema,
  handler: async ({ tx, ctx }) => listReportSchedules(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createReportScheduleBodySchema>,
  z.output<typeof createReportScheduleResponseSchema>
>({
  metadata: createReportScheduleMetadata,
  input: createReportScheduleBodySchema,
  output: createReportScheduleResponseSchema,
  handler: async ({ tx, ctx, input }) => createReportSchedule(tx, ctx, input),
});
