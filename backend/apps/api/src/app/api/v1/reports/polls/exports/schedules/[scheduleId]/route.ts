import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deletePollExportScheduleResponseSchema,
  pollExportScheduleParamsSchema,
  updatePollExportScheduleBodySchema,
  updatePollExportScheduleResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import { mutatePollsExportScheduleMetadata } from "@atlas/domain/reports/polls-exports.route-metadata";
import {
  deletePollExportSchedule,
  updatePollExportSchedule,
} from "@atlas/domain/reports/polls-exports.service";

export const PATCH = createTenantRoute<
  z.output<typeof updatePollExportScheduleBodySchema>,
  z.output<typeof updatePollExportScheduleResponseSchema>,
  typeof pollExportScheduleParamsSchema
>({
  metadata: mutatePollsExportScheduleMetadata,
  params: pollExportScheduleParamsSchema,
  body: updatePollExportScheduleBodySchema,
  output: updatePollExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePollExportSchedule(tx, ctx, params.scheduleId, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deletePollExportScheduleResponseSchema>,
  typeof pollExportScheduleParamsSchema
>({
  metadata: mutatePollsExportScheduleMetadata,
  params: pollExportScheduleParamsSchema,
  input: noBodySchema,
  output: deletePollExportScheduleResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    deletePollExportSchedule(tx, ctx, params.scheduleId),
});
