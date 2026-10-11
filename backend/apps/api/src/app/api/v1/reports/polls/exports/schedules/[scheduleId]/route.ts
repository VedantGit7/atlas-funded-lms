import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPollExportResponseSchema,
  updatePollExportScheduleResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import {
  deletePollExportSchedule,
  runPollExportScheduleNow,
  updatePollExportSchedule,
} from "@atlas/domain/reports/polls-exports.service";
import {
  deleteReportExportScheduleResponseSchema,
  reportExportScheduleParamsSchema,
  updateReportExportScheduleBodySchema,
} from "@atlas/domain/reports/report-exports.dto";
import { mutateReportExportScheduleMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateReportExportScheduleBodySchema>,
  z.output<typeof updatePollExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  body: updateReportExportScheduleBodySchema,
  output: updatePollExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePollExportSchedule(tx, ctx, params["scheduleId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteReportExportScheduleResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: deleteReportExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) => deletePollExportSchedule(tx, ctx, params["scheduleId"]),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createPollExportResponseSchema>,
  typeof reportExportScheduleParamsSchema
>({
  metadata: mutateReportExportScheduleMetadata,
  params: reportExportScheduleParamsSchema,
  input: noBodySchema,
  output: createPollExportResponseSchema,
  handler: async ({ tx, ctx, params }) => runPollExportScheduleNow(tx, ctx, params["scheduleId"]),
});
