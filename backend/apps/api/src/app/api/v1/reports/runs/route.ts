import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createReportRunBodySchema,
  createReportRunResponseSchema,
  reportListQuerySchema,
  reportRunListResponseSchema,
} from "@atlas/domain/reports/reports.dto";
import { createReportRun, listReportRuns } from "@atlas/domain/reports/reports.service";
import {
  createReportRunMetadata,
  listReportRunsMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof reportListQuerySchema>,
  z.output<typeof reportRunListResponseSchema>
>({
  metadata: listReportRunsMetadata,
  input: reportListQuerySchema,
  output: reportRunListResponseSchema,
  handler: async ({ tx, ctx, input }) => listReportRuns(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createReportRunBodySchema>,
  z.output<typeof createReportRunResponseSchema>
>({
  metadata: createReportRunMetadata,
  input: createReportRunBodySchema,
  output: createReportRunResponseSchema,
  handler: async ({ tx, ctx, input }) => createReportRun(tx, ctx, input),
});
