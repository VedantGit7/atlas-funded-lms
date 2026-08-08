import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollExportRunDetailResponseSchema,
  pollExportRunParamsSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import { getPollsExportsMetadata } from "@atlas/domain/reports/polls-exports.route-metadata";
import { getPollExportRun } from "@atlas/domain/reports/polls-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollExportRunDetailResponseSchema>,
  typeof pollExportRunParamsSchema
>({
  metadata: getPollsExportsMetadata,
  params: pollExportRunParamsSchema,
  input: noBodySchema,
  output: pollExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollExportRun(tx, ctx, params["runId"]),
});
